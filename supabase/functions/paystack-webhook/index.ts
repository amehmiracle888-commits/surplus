// Supabase Edge Function: Paystack Webhook Verification & Event Processor
// Deploy with: supabase functions deploy paystack-webhook --no-verify-jwt
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

async function verifyPaystackSignature(bodyText: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
  const hashHex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hashHex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hashHex.length; i++) {
    diff |= hashHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const appUrl = Deno.env.get("APP_URL") ?? "";
  const internalSecret = Deno.env.get("CRON_SECRET") ?? "";

  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  const valid = await verifyPaystackSignature(rawBody, signature, paystackSecret);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid Paystack signature" }), { status: 401 });
  }

  const event = JSON.parse(rawBody);
  if (event?.event !== "charge.success") {
    return new Response(JSON.stringify({ received: true, ignored: event?.event }), { status: 200 });
  }

  const reference: string | undefined = event?.data?.reference;
  if (!reference) {
    return new Response(JSON.stringify({ error: "Missing reference" }), { status: 400 });
  }

  // Forward verified webhook processing to Next.js internal verification endpoint or verify directly
  if (appUrl && internalSecret) {
    const resp = await fetch(`${appUrl}/api/payments/paystack/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-paystack-signature": signature ?? "",
      },
      body: rawBody,
    });
    const text = await resp.text();
    return new Response(text, { status: resp.status, headers: { "Content-Type": "application/json" } });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  await supabase
    .from("payment_transactions")
    .update({ webhook_received_at: new Date().toISOString() })
    .eq("reference", reference);

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
