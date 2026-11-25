import type {
  SupplierAdapter,
  SupplierConnectionTestResult,
  SupplierMessageRecord,
  SupplierProvisionRequest,
  SupplierProvisionResult,
  SupplierRuntimeContext,
  SupplierUsageResult,
} from "@/lib/suppliers/types";

function buildAuthHeaders(ctx: SupplierRuntimeContext): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(ctx.config.extraHeaders ?? {}),
  };

  if (ctx.authMethod === "bearer" && ctx.apiKey) {
    headers["Authorization"] = `Bearer ${ctx.apiKey}`;
  } else if (ctx.authMethod === "api_key_header" && ctx.apiKey) {
    headers[ctx.config.headerName || "X-API-Key"] = ctx.apiKey;
  } else if (ctx.authMethod === "custom_header" && ctx.apiKey) {
    headers[ctx.config.headerName || "Authorization"] = ctx.apiKey;
  } else if (ctx.authMethod === "basic" && (ctx.apiKey || ctx.apiSecret)) {
    const token = Buffer.from(`${ctx.apiKey}:${ctx.apiSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${token}`;
  }

  return headers;
}

function joinEndpoint(baseUrl: string, endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const base = baseUrl.replace(/\/+$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

function readJsonPath(obj: unknown, path: string | undefined): unknown {
  if (!path || !obj || typeof obj !== "object") return undefined;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Configurable REST Supplier Adapter.
 * Strictly executes HTTP calls ONLY against endpoints explicitly documented & configured
 * by the administrator in `suppliers.api_base_url` and `suppliers.config`.
 */
export class ConfigurableRestAdapter implements SupplierAdapter {
  readonly key = "custom_rest";
  readonly label = "Configurable REST API Adapter";

  async testConnection(ctx: SupplierRuntimeContext): Promise<SupplierConnectionTestResult> {
    const started = Date.now();
    if (!ctx.apiBaseUrl) {
      return {
        ok: false,
        latencyMs: 0,
        message: "API Base URL is required before testing connection.",
      };
    }

    const endpoint = ctx.config.testEndpoint || ctx.config.balanceEndpoint;
    if (!endpoint) {
      return {
        ok: false,
        latencyMs: 0,
        message:
          "No testEndpoint or balanceEndpoint configured in supplier JSON settings. Add the official endpoint from the supplier's documentation.",
      };
    }

    try {
      const targetUrl = joinEndpoint(ctx.apiBaseUrl, endpoint);
      const res = await fetch(targetUrl, {
        method: "GET",
        headers: buildAuthHeaders(ctx),
        signal: AbortSignal.timeout(12_000),
      });
      const latencyMs = Date.now() - started;
      const text = await res.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        parsed = { rawText: text.slice(0, 500) };
      }

      if (!res.ok) {
        return {
          ok: false,
          httpStatus: res.status,
          latencyMs,
          message: `Supplier responded with HTTP ${res.status}`,
          raw: parsed,
        };
      }

      const rawBalance = readJsonPath(parsed, ctx.config.balanceJsonPath);
      const numericBalance = typeof rawBalance === "number" ? rawBalance : Number(rawBalance);

      return {
        ok: true,
        httpStatus: res.status,
        latencyMs,
        message: `Connected successfully (HTTP ${res.status} in ${latencyMs}ms)`,
        balanceAmount: Number.isFinite(numericBalance) ? numericBalance : undefined,
        raw: parsed,
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: err instanceof Error ? err.message : "Network error while contacting supplier API",
      };
    }
  }

  async fetchCatalog(
    ctx: SupplierRuntimeContext
  ): Promise<{ ok: boolean; items: unknown[]; errorMessage?: string }> {
    if (!ctx.apiBaseUrl || !ctx.config.productsEndpoint) {
      return {
        ok: false,
        items: [],
        errorMessage: "productsEndpoint is not configured for this supplier.",
      };
    }
    try {
      const res = await fetch(joinEndpoint(ctx.apiBaseUrl, ctx.config.productsEndpoint), {
        method: "GET",
        headers: buildAuthHeaders(ctx),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, items: [], errorMessage: `HTTP ${res.status}` };
      }
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.data)
            ? data.data
            : [];
      return { ok: true, items };
    } catch (err) {
      return {
        ok: false,
        items: [],
        errorMessage: err instanceof Error ? err.message : "Failed to fetch supplier catalog",
      };
    }
  }

  async provision(
    ctx: SupplierRuntimeContext,
    req: SupplierProvisionRequest
  ): Promise<SupplierProvisionResult> {
    if (!ctx.apiBaseUrl || !ctx.config.provisionEndpoint) {
      return {
        status: "failed",
        retryable: false,
        errorMessage: "provisionEndpoint is not configured on supplier. Cannot execute automated provisioning.",
      };
    }

    try {
      const res = await fetch(joinEndpoint(ctx.apiBaseUrl, ctx.config.provisionEndpoint), {
        method: "POST",
        headers: {
          ...buildAuthHeaders(ctx),
          "Idempotency-Key": req.idempotencyKey,
        },
        body: JSON.stringify({
          external_product_id: req.externalProductId,
          plan_code: req.externalPlanCode,
          quantity: req.quantity,
          duration_days: req.durationDays,
          options: req.selectedOptions,
          order_reference: req.orderReference,
          customer_email: req.customerEmail,
        }),
        signal: AbortSignal.timeout(25_000),
      });

      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        return {
          status: "failed",
          httpStatus: res.status,
          rawResponse: body,
          retryable: res.status >= 500 || res.status === 429,
          errorMessage:
            (typeof body.message === "string" && body.message) ||
            (typeof body.error === "string" && body.error) ||
            `Supplier API returned HTTP ${res.status}`,
        };
      }

      const externalReference =
        (typeof body.id === "string" && body.id) ||
        (typeof body.reference === "string" && body.reference) ||
        (typeof body.order_id === "string" && body.order_id) ||
        undefined;

      const credentials =
        (body.credentials && typeof body.credentials === "object"
          ? (body.credentials as Record<string, unknown>)
          : body) ?? {};

      return {
        status: "delivered",
        httpStatus: res.status,
        externalReference,
        credentials,
        publicMetadata:
          body.metadata && typeof body.metadata === "object"
            ? (body.metadata as Record<string, unknown>)
            : {},
        expiresAt: typeof body.expires_at === "string" ? body.expires_at : undefined,
        rawResponse: body,
      };
    } catch (err) {
      return {
        status: "failed",
        retryable: true,
        errorMessage: err instanceof Error ? err.message : "Supplier API request timed out",
      };
    }
  }

  async renew(
    ctx: SupplierRuntimeContext,
    params: { externalServiceId: string; durationDays: number; idempotencyKey: string }
  ): Promise<SupplierProvisionResult> {
    if (!ctx.apiBaseUrl || !ctx.config.renewEndpoint) {
      return {
        status: "pending_manual",
        retryable: false,
        errorMessage: "renewEndpoint is not configured on supplier.",
      };
    }

    try {
      const endpoint = ctx.config.renewEndpoint.replace("{id}", encodeURIComponent(params.externalServiceId));
      const res = await fetch(joinEndpoint(ctx.apiBaseUrl, endpoint), {
        method: "POST",
        headers: {
          ...buildAuthHeaders(ctx),
          "Idempotency-Key": params.idempotencyKey,
        },
        body: JSON.stringify({
          service_id: params.externalServiceId,
          duration_days: params.durationDays,
        }),
        signal: AbortSignal.timeout(20_000),
      });

      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        return {
          status: "failed",
          httpStatus: res.status,
          rawResponse: body,
          retryable: res.status >= 500 || res.status === 429,
          errorMessage: `Supplier renewal returned HTTP ${res.status}`,
        };
      }

      return {
        status: "delivered",
        httpStatus: res.status,
        externalReference: params.externalServiceId,
        expiresAt: typeof body.expires_at === "string" ? body.expires_at : undefined,
        rawResponse: body,
      };
    } catch (err) {
      return {
        status: "failed",
        retryable: true,
        errorMessage: err instanceof Error ? err.message : "Supplier renewal request failed",
      };
    }
  }

  async checkUsage(ctx: SupplierRuntimeContext, externalServiceId: string): Promise<SupplierUsageResult> {
    if (!ctx.apiBaseUrl || !ctx.config.usageEndpoint) {
      return { ok: false, supported: false, errorMessage: "Usage endpoint not configured" };
    }
    try {
      const endpoint = ctx.config.usageEndpoint.replace("{id}", encodeURIComponent(externalServiceId));
      const res = await fetch(joinEndpoint(ctx.apiBaseUrl, endpoint), {
        method: "GET",
        headers: buildAuthHeaders(ctx),
        signal: AbortSignal.timeout(12_000),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        return { ok: false, supported: true, errorMessage: `HTTP ${res.status}` };
      }
      return {
        ok: true,
        supported: true,
        bandwidthTotalMb: typeof body.total_mb === "number" ? body.total_mb : undefined,
        bandwidthUsedMb: typeof body.used_mb === "number" ? body.used_mb : undefined,
        bandwidthRemainingMb: typeof body.remaining_mb === "number" ? body.remaining_mb : undefined,
        raw: body,
      };
    } catch (err) {
      return {
        ok: false,
        supported: true,
        errorMessage: err instanceof Error ? err.message : "Failed to query usage",
      };
    }
  }

  async fetchInboundMessages(
    ctx: SupplierRuntimeContext,
    externalServiceId: string
  ): Promise<{ ok: boolean; supported: boolean; messages: SupplierMessageRecord[]; errorMessage?: string }> {
    if (!ctx.apiBaseUrl || !ctx.config.messagesEndpoint) {
      return {
        ok: false,
        supported: false,
        messages: [],
        errorMessage: "Inbound SMS endpoint not configured for this supplier.",
      };
    }
    try {
      const endpoint = ctx.config.messagesEndpoint.replace("{id}", encodeURIComponent(externalServiceId));
      const res = await fetch(joinEndpoint(ctx.apiBaseUrl, endpoint), {
        method: "GET",
        headers: buildAuthHeaders(ctx),
        signal: AbortSignal.timeout(12_000),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, supported: true, messages: [], errorMessage: `HTTP ${res.status}` };
      }
      const list = Array.isArray(body?.messages) ? body.messages : Array.isArray(body) ? body : [];
      return { ok: true, supported: true, messages: list as SupplierMessageRecord[] };
    } catch (err) {
      return {
        ok: false,
        supported: true,
        messages: [],
        errorMessage: err instanceof Error ? err.message : "Failed to fetch messages",
      };
    }
  }
}
