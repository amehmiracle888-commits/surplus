// Supabase Edge Function: Bachs.io Webhook Verification & Event Processor
// Deploy with: supabase functions deploy bachs-webhook --no-verify-jwt
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

async function verifyBachsSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !timestamp || !secret) return false;
  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > 300) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signedPayload = `${timestamp}.${rawBody}`;
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expectedHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expectedHex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const webhookSecret = Deno.env.get("BACHS_WEBHOOK_SECRET") ?? "";
  const appUrl = Deno.env.get("APP_URL") ?? "";
  const rawBody = await req.text();
  const signature = req.headers.get("x-bachs-signature");
  const timestamp = req.headers.get("x-bachs-timestamp");

  const valid = await verifyBachsSignature(rawBody, signature, timestamp, webhookSecret);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid Bachs webhook signature" }), { status: 401 });
  }

  if (!appUrl) {
    return new Response(JSON.stringify({ error: "APP_URL not configured" }), { status: 500 });
  }

  const resp = await fetch(`${appUrl}/api/payments/bachs/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bachs-signature": signature ?? "",
      "x-bachs-timestamp": timestamp ?? "",
    },
    body: rawBody,
  });

  const text = await resp.text();
  return new Response(text, { status: resp.status, headers: { "Content-Type": "application/json" } });
});
