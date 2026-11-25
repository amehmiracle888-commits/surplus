import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processOrderFulfilment } from "@/lib/fulfilment";
import { sendNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // 1. Retry eligible automated fulfilments
  const nowIso = new Date().toISOString();
  const { data: dueRetries } = await admin
    .from("order_fulfilments")
    .select("order_id")
    .eq("status", "retrying")
    .lte("next_retry_at", nowIso);

  const retriedOrderIds = Array.from(new Set((dueRetries ?? []).map((r) => r.order_id)));
  for (const orderId of retriedOrderIds) {
    await processOrderFulfilment(orderId).catch(() => null);
  }

  // 2. Mark expiring services (within 3 days) and send reminders
  const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: expiringServices } = await admin
    .from("customer_services")
    .select("id, user_id, service_label, expires_at")
    .eq("status", "active")
    .lte("expires_at", threeDaysLater)
    .gt("expires_at", nowIso);

  for (const srv of expiringServices ?? []) {
    await admin.from("customer_services").update({ status: "expiring_soon" }).eq("id", srv.id);
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", srv.user_id)
      .maybeSingle();

    await sendNotification({
      userId: srv.user_id,
      type: "expiry_reminder",
      recipientEmail: profile?.email,
      subject: `Subscription Expiring Soon - ${srv.service_label}`,
      bodyText: `Your ${srv.service_label} subscription expires on ${srv.expires_at}. Renew in your dashboard to avoid interruption.`,
      bodyHtml: `<p>Your <strong>${srv.service_label}</strong> subscription expires on <strong>${new Date(srv.expires_at!).toUTCString()}</strong>.</p><p>Visit Renewals in your dashboard to renew.</p>`,
    });
  }

  // 3. Mark expired services
  await admin
    .from("customer_services")
    .update({ status: "expired" })
    .in("status", ["active", "expiring_soon"])
    .lte("expires_at", nowIso);

  return NextResponse.json({
    ok: true,
    retriedOrders: retriedOrderIds.length,
    expiryRemindersSent: (expiringServices ?? []).length,
  });
}
