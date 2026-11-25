// Supabase Edge Function: Scheduled Expiry Reminders & Fulfilment Retries
// Invoke on a cron schedule via Supabase Scheduled Edge Functions
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const appUrl = Deno.env.get("APP_URL") ?? "";
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  if (!appUrl) {
    return new Response(JSON.stringify({ error: "APP_URL not configured" }), { status: 500 });
  }

  const res = await fetch(`${appUrl}/api/cron/maintenance`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
    },
  });

  const payload = await res.text();
  return new Response(payload, { status: res.status, headers: { "Content-Type": "application/json" } });
});
