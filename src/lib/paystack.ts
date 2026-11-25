import crypto from "crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getPaystackSecret(): string {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }
  return secret;
}

export interface PaystackInitializeRequest {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  channels?: ("card" | "bank" | "ussd" | "qr" | "mobile_money" | "bank_transfer")[];
}

export interface PaystackInitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackVerificationData {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  channel: string;
  fees?: number;
  paid_at?: string;
  customer?: {
    email?: string;
  };
  metadata?: Record<string, unknown>;
}

export async function initializePaystackTransaction(
  payload: PaystackInitializeRequest
): Promise<PaystackInitializeResponse> {
  const secret = getPaystackSecret();

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: payload.email,
      amount: payload.amountKobo,
      currency: "NGN",
      reference: payload.reference,
      callback_url: payload.callbackUrl,
      channels: payload.channels ?? ["card", "bank_transfer", "ussd", "bank"],
      metadata: payload.metadata ?? {},
    }),
  });

  const json = await response.json();
  if (!response.ok || !json.status) {
    throw new Error(json.message || "Failed to initialize Paystack transaction");
  }

  return json.data as PaystackInitializeResponse;
}

export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerificationData> {
  const secret = getPaystackSecret();

  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
    }
  );

  const json = await response.json();
  if (!response.ok || !json.status || !json.data) {
    throw new Error(json.message || "Failed to verify Paystack transaction");
  }

  return json.data as PaystackVerificationData;
}

/**
 * Verifies the x-paystack-signature header using constant-time HMAC-SHA512 comparison.
 */
export function verifyPaystackWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secretOverride?: string
): boolean {
  const secret = secretOverride ?? process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!signatureHeader || !secret) return false;

  const expectedHex = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expectedHex, "utf8");
  const actualBuf = Buffer.from(signatureHeader, "utf8");

  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
