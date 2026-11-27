/**
 * Server-side client for VirtualSMS (https://api.virtualsms.de/stubs/handler_api)
 * Compatible with SMS-Activate REST conventions.
 * Never import this file in client components or expose VIRTUALSMS_API_KEY.
 */

const VIRTUALSMS_BASE_URL = "https://api.virtualsms.de/stubs/handler_api";

export interface VirtualSmsService {
  code: string;
  name: string;
}

export interface VirtualSmsCountry {
  id: string;
  name: string;
  iso?: string;
}

export interface VirtualSmsPriceEntry {
  cost: number;
  count: number;
}

export type VirtualSmsPricesMap = Record<string, Record<string, VirtualSmsPriceEntry>>;

export interface VirtualSmsNumberResult {
  activationId: string;
  phoneNumber: string;
  wholesaleCostUsd: number;
  raw: Record<string, unknown>;
}

export interface VirtualSmsStatusResult {
  status: "pending" | "received" | "cancelled";
  code: string | null;
  text: string | null;
  raw: Record<string, unknown>;
}

const KNOWN_ERROR_MESSAGES: Record<string, { message: string; status: number }> = {
  MISSING_API_KEY: {
    message: "VirtualSMS API key is not configured on the server.",
    status: 503,
  },
  BAD_KEY: {
    message: "VirtualSMS API key is invalid or unauthorized.",
    status: 502,
  },
  NO_NUMBERS: {
    message: "No numbers are currently available for this service and country. Please try another option.",
    status: 409,
  },
  NO_BALANCE: {
    message: "Service is temporarily unavailable because the upstream supplier balance is depleted.",
    status: 503,
  },
  EARLY_CANCEL_DENIED: {
    message: "Cancellation is not allowed yet. Please wait at least 5 minutes from order creation.",
    status: 400,
  },
  BAD_ACTION: {
    message: "Unsupported VirtualSMS API action requested.",
    status: 502,
  },
  BAD_SERVICE: {
    message: "Invalid or unsupported service code.",
    status: 400,
  },
  BAD_STATUS: {
    message: "Invalid activation status transition.",
    status: 400,
  },
  WRONG_ACTIVATION_ID: {
    message: "Invalid activation ID.",
    status: 404,
  },
  NO_ACTIVATION: {
    message: "Activation not found on VirtualSMS.",
    status: 404,
  },
  BANNED: {
    message: "Upstream VirtualSMS account access is restricted.",
    status: 503,
  },
};

export class VirtualSmsError extends Error {
  code: string;
  httpStatus: number;
  raw?: string;

  constructor(code: string, customMessage?: string, httpStatus?: number, raw?: string) {
    const known = KNOWN_ERROR_MESSAGES[code];
    super(customMessage || known?.message || `VirtualSMS API error: ${code}`);
    this.name = "VirtualSmsError";
    this.code = code;
    this.httpStatus = httpStatus ?? known?.status ?? 502;
    this.raw = raw;
  }
}

function getApiKey(): string {
  const key = process.env.VIRTUALSMS_API_KEY?.trim();
  if (!key) {
    throw new VirtualSmsError("MISSING_API_KEY");
  }
  return key;
}

function detectErrorCodeFromText(text: string): string | null {
  const trimmed = text.trim();
  for (const code of Object.keys(KNOWN_ERROR_MESSAGES)) {
    if (trimmed === code || trimmed.startsWith(`${code}:`)) {
      return code;
    }
  }
  if (/^(ERROR|BAD_|NO_|WRONG_|EARLY_|BANNED)/i.test(trimmed)) {
    return trimmed.split(":")[0].toUpperCase();
  }
  return null;
}

async function callVirtualSms(
  action: string,
  params: Record<string, string | number | undefined> = {}
): Promise<string> {
  const apiKey = getApiKey();
  const url = new URL(VIRTUALSMS_BASE_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("api_key", apiKey);

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new VirtualSmsError(
      "UPSTREAM_UNREACHABLE",
      err instanceof Error ? `Unable to reach VirtualSMS: ${err.message}` : "Unable to reach VirtualSMS",
      502
    );
  }

  const text = await response.text();
  const trimmed = text.trim();

  if (!response.ok && !trimmed) {
    throw new VirtualSmsError("HTTP_ERROR", `VirtualSMS returned HTTP ${response.status}`, 502);
  }

  // Check JSON error envelopes if returned
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const errField =
          (typeof parsed.error === "string" && parsed.error) ||
          (typeof parsed.msg === "string" && detectErrorCodeFromText(parsed.msg)) ||
          (typeof parsed.status === "string" && detectErrorCodeFromText(parsed.status));
        if (errField) {
          const code = detectErrorCodeFromText(errField) || errField.toUpperCase();
          throw new VirtualSmsError(code, undefined, undefined, trimmed);
        }
      }
    } catch (e) {
      if (e instanceof VirtualSmsError) throw e;
    }
    return trimmed;
  }

  const textError = detectErrorCodeFromText(trimmed);
  if (textError) {
    throw new VirtualSmsError(textError, undefined, undefined, trimmed);
  }

  return trimmed;
}

export async function getBalance(): Promise<number> {
  const raw = await callVirtualSms("getBalance");

  if (raw.startsWith("{")) {
    const parsed = JSON.parse(raw) as { balance?: number | string };
    const val = Number(parsed.balance);
    if (!Number.isFinite(val)) throw new VirtualSmsError("INVALID_BALANCE", "Invalid balance response", 502, raw);
    return val;
  }

  if (raw.startsWith("ACCESS_BALANCE:")) {
    const val = Number(raw.split(":")[1]);
    if (!Number.isFinite(val)) throw new VirtualSmsError("INVALID_BALANCE", "Invalid balance response", 502, raw);
    return val;
  }

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;
  throw new VirtualSmsError("INVALID_BALANCE", `Unexpected balance payload: ${raw}`, 502, raw);
}

export async function getServicesList(): Promise<VirtualSmsService[]> {
  const raw = await callVirtualSms("getServicesList");
  const parsed = JSON.parse(raw) as unknown;

  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => {
        const obj = item as Record<string, unknown>;
        const code = String(obj.code ?? obj.id ?? obj.service ?? "").trim();
        const name = String(obj.name ?? obj.title ?? code).trim();
        return { code, name };
      })
      .filter((s) => s.code.length > 0);
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.services)) {
      return (obj.services as Record<string, unknown>[])
        .map((item) => ({
          code: String(item.code ?? item.id ?? item.service ?? "").trim(),
          name: String(item.name ?? item.title ?? item.code ?? "").trim(),
        }))
        .filter((s) => s.code.length > 0);
    }

    return Object.entries(obj)
      .map(([k, v]) => {
        if (typeof v === "string") return { code: k, name: v };
        if (v && typeof v === "object") {
          const rec = v as Record<string, unknown>;
          return {
            code: String(rec.code ?? k),
            name: String(rec.name ?? rec.title ?? k),
          };
        }
        return { code: k, name: k };
      })
      .filter((s) => s.code.length > 0);
  }

  return [];
}

export async function getCountries(): Promise<VirtualSmsCountry[]> {
  const raw = await callVirtualSms("getCountries");
  const parsed = JSON.parse(raw) as unknown;

  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => {
        const obj = item as Record<string, unknown>;
        return {
          id: String(obj.id ?? obj.country ?? "").trim(),
          name: String(obj.eng ?? obj.name ?? obj.rus ?? obj.id ?? "").trim(),
          iso: typeof obj.iso === "string" ? obj.iso : undefined,
        };
      })
      .filter((c) => c.id.length > 0);
  }

  if (parsed && typeof parsed === "object") {
    return Object.entries(parsed as Record<string, unknown>)
      .map(([key, val]) => {
        if (typeof val === "string") return { id: key, name: val };
        const obj = (val || {}) as Record<string, unknown>;
        return {
          id: String(obj.id ?? key).trim(),
          name: String(obj.eng ?? obj.name ?? obj.title ?? key).trim(),
          iso: typeof obj.iso === "string" ? obj.iso : undefined,
        };
      })
      .filter((c) => c.id.length > 0);
  }

  return [];
}

export async function getPrices(country?: string, service?: string): Promise<VirtualSmsPricesMap> {
  const raw = await callVirtualSms("getPrices", { country, service });
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const result: VirtualSmsPricesMap = {};

  for (const [countryKey, servicesVal] of Object.entries(parsed || {})) {
    if (!servicesVal || typeof servicesVal !== "object") continue;
    result[countryKey] = {};
    for (const [serviceKey, infoVal] of Object.entries(servicesVal as Record<string, unknown>)) {
      if (!infoVal || typeof infoVal !== "object") continue;
      const info = infoVal as Record<string, unknown>;
      const cost = Number(info.cost ?? info.price ?? 0);
      const count = Number(info.count ?? info.physicalCount ?? 0);
      if (Number.isFinite(cost) && Number.isFinite(count)) {
        result[countryKey][serviceKey] = { cost, count };
      }
    }
  }

  return result;
}

export async function getNumberV2(service: string, country: string): Promise<VirtualSmsNumberResult> {
  const raw = await callVirtualSms("getNumberV2", { service, country });

  if (raw.startsWith("{")) {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const activationId = String(parsed.activationId ?? parsed.id ?? "").trim();
    const phoneNumber = String(parsed.phoneNumber ?? parsed.phone ?? parsed.number ?? "").trim();
    const wholesaleCostUsd = Number(parsed.activationCost ?? parsed.cost ?? 0);

    if (!activationId || !phoneNumber) {
      throw new VirtualSmsError("INVALID_NUMBER_RESPONSE", "VirtualSMS returned an incomplete number response.", 502, raw);
    }

    return {
      activationId,
      phoneNumber,
      wholesaleCostUsd: Number.isFinite(wholesaleCostUsd) ? wholesaleCostUsd : 0,
      raw: parsed,
    };
  }

  if (raw.startsWith("ACCESS_NUMBER:")) {
    const [, activationId = "", phoneNumber = ""] = raw.split(":");
    if (!activationId || !phoneNumber) {
      throw new VirtualSmsError("INVALID_NUMBER_RESPONSE", "Malformed ACCESS_NUMBER payload.", 502, raw);
    }
    return {
      activationId: activationId.trim(),
      phoneNumber: phoneNumber.trim(),
      wholesaleCostUsd: 0,
      raw: { raw },
    };
  }

  throw new VirtualSmsError("INVALID_NUMBER_RESPONSE", `Unexpected getNumberV2 payload: ${raw}`, 502, raw);
}

export async function getStatusV2(activationId: string): Promise<VirtualSmsStatusResult> {
  const raw = await callVirtualSms("getStatusV2", { id: activationId });

  if (raw.startsWith("{")) {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const statusRaw = String(parsed.status ?? "").toUpperCase();
    const smsObj = parsed.sms && typeof parsed.sms === "object" ? (parsed.sms as Record<string, unknown>) : null;
    const code =
      (smsObj && typeof smsObj.code === "string" && smsObj.code) ||
      (typeof parsed.code === "string" && parsed.code) ||
      null;
    const text =
      (smsObj && typeof smsObj.text === "string" && smsObj.text) ||
      (typeof parsed.text === "string" && parsed.text) ||
      code;

    if (statusRaw === "STATUS_CANCEL" || statusRaw === "CANCELLED") {
      return { status: "cancelled", code: null, text: null, raw: parsed };
    }
    if (statusRaw === "STATUS_OK" || code) {
      return { status: "received", code: code || text, text: text || code, raw: parsed };
    }
    return { status: "pending", code: null, text: null, raw: parsed };
  }

  if (raw === "STATUS_WAIT_CODE" || raw === "STATUS_WAIT_RETRY") {
    return { status: "pending", code: null, text: null, raw: { raw } };
  }
  if (raw === "STATUS_CANCEL") {
    return { status: "cancelled", code: null, text: null, raw: { raw } };
  }
  if (raw.startsWith("STATUS_OK:")) {
    const code = raw.slice("STATUS_OK:".length).trim();
    return { status: "received", code, text: code, raw: { raw } };
  }

  return { status: "pending", code: null, text: null, raw: { raw } };
}

export async function setStatus(
  activationId: string,
  status: 1 | 3 | 6 | 8
): Promise<{ raw: string }> {
  const raw = await callVirtualSms("setStatus", { id: activationId, status });
  return { raw };
}
