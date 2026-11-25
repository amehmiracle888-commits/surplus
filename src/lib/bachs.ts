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

export interface BachsCheckoutSession {
  id: string;
  object?: string;
  status: string;
  payment_status: string;
  currency: string;
  amount_total?: string | number;
  checkout_url: string;
  customer_details?: {
    email?: string;
    name?: string;
  };
  metadata?: Record<string, unknown>;
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

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.message || json?.error || `Bachs API HTTP ${response.status}`);
  }

  return (json?.data ?? json) as BachsCheckoutSession;
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

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.message || json?.error || `Bachs verification HTTP ${response.status}`);
  }

  return (json?.data ?? json) as BachsCheckoutSession;
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
