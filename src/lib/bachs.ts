import crypto from "crypto";

function getBachsSecretKey(): string {
  const key = process.env.BACHS_SECRET_KEY;
  if (!key) {
    throw new Error("BACHS_SECRET_KEY is not configured");
  }
  return key;
}

export function getBachsBaseUrl(secretKey?: string): string {
  const key = secretKey ?? process.env.BACHS_SECRET_KEY ?? "";
  const env = process.env.BACHS_ENV;
  if (env === "sandbox" || key.startsWith("sk_sandbox_")) {
    return "https://sandbox-api.bachs.io";
  }
  return "https://api.bachs.io";
}

export class BachsApiError extends Error {
  status: number;
  errorCode?: string;
  detail?: string;

  constructor(status: number, message: string, errorCode?: string, detail?: string) {
    super(message);
    this.name = "BachsApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.detail = detail;
  }
}

export interface BachsCheckoutSession {
  id: string;
  checkout_id?: string;
  object?: string;
  status: string;
  payment_status: string;
  currency: string;
  amount?: string | number;
  amount_total?: string | number;
  checkout_url: string;
  customer_details?: {
    email?: string;
    name?: string;
  };
  metadata?: Record<string, unknown>;
}

function normalizeBachsSession(raw: Record<string, unknown>): BachsCheckoutSession {
  const obj = (raw?.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>;
  const resolvedId = String(obj.checkout_id || obj.id || "");
  return {
    ...(obj as unknown as BachsCheckoutSession),
    id: resolvedId,
    checkout_id: resolvedId,
    amount_total: (obj.amount_total ?? obj.amount) as string | number | undefined,
  };
}

export async function createBachsCheckoutSession(params: {
  amountKobo: number;
  email: string;
  name?: string;
  reference: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<BachsCheckoutSession> {
  const secretKey = getBachsSecretKey();
  const baseUrl = getBachsBaseUrl(secretKey);
  const amountNairaStr = (params.amountKobo / 100).toFixed(2);

  const response = await fetch(`${baseUrl}/v1/checkout-sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      pricing: {
        amount: amountNairaStr,
        currency: "NGN",
      },
      customer: {
        email: params.email,
        ...(params.name ? { name: params.name } : {}),
      },
      metadata: {
        reference: params.reference,
        ...(params.metadata ?? {}),
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    }),
  });

  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const detail =
      (typeof json?.detail === "string" && json.detail) ||
      (typeof json?.message === "string" && json.message) ||
      (typeof json?.error === "string" && json.error) ||
      `Payment provider returned HTTP ${response.status}`;
    const errorCode = typeof json?.error_code === "string" ? json.error_code : undefined;

    console.error("[Bachs createCheckoutSession error]", {
      httpStatus: response.status,
      errorCode,
      detail,
      successUrl: params.successUrl,
    });

    throw new BachsApiError(response.status, detail, errorCode, detail);
  }

  const normalized = normalizeBachsSession(json);
  if (!normalized.id || !normalized.checkout_url) {
    throw new BachsApiError(502, "Payment provider returned an incomplete checkout session.");
  }
  return normalized;
}

export async function retrieveBachsCheckoutSession(
  checkoutSessionId: string
): Promise<BachsCheckoutSession> {
  const secretKey = getBachsSecretKey();
  const baseUrl = getBachsBaseUrl(secretKey);

  const response = await fetch(
    `${baseUrl}/v1/checkout-sessions/${encodeURIComponent(checkoutSessionId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const detail =
      (typeof json?.detail === "string" && json.detail) ||
      (typeof json?.message === "string" && json.message) ||
      `Payment verification returned HTTP ${response.status}`;
    throw new BachsApiError(response.status, detail);
  }

  return normalizeBachsSession(json);
}

/**
 * Verifies Bachs.io webhook deliveries using X-Bachs-Timestamp + "." + rawBody with HMAC-SHA256
 * and a 300-second replay-protection tolerance window.
 */
export function verifyBachsWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  secretOverride?: string,
  nowSecondsOverride?: number
): boolean {
  const secret = secretOverride ?? process.env.BACHS_WEBHOOK_SECRET ?? "";
  if (!signatureHeader || !timestampHeader || !secret) return false;

  const ts = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(ts)) return false;

  const currentSec = nowSecondsOverride ?? Math.floor(Date.now() / 1000);
  if (Math.abs(currentSec - ts) > 300) return false;

  const signedPayload = `${timestampHeader}.${rawBody}`;
  const expectedHex = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  const expectedBuf = Buffer.from(expectedHex, "utf8");
  const actualBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
