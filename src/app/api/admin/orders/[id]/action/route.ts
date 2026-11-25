import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptJsonSecret } from "@/lib/crypto";
import { processOrderFulfilment, refundOrderToWallet } from "@/lib/fulfilment";
import { sendNotification } from "@/lib/notifications";
import { writeAuditLog } from "@/lib/audit";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("manual_fulfil"),
    credentials: z.record(z.string(), z.unknown()),
    publicMetadata: z.record(z.string(), z.unknown()).optional(),
    expiresAt: z.string().optional().nullable(),
  }),
  z.object({
    action: z.literal("retry"),
  }),
  z.object({
    action: z.literal("refund"),
    reason: z.string().min(3).max(300),
  }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid order action payload" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("*, items:order_items(*)")
      .eq("id", id)
      .single();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (parsed.data.action === "retry") {
      const result = await processOrderFulfilment(order.id);
      await writeAuditLog({
        actorId: actor.id,
        actorRole: actor.role,
        action: "order.admin_retry",
        entityType: "order",
        entityId: order.id,
        afterState: result,
      });
      return NextResponse.json(result);
    }

    if (parsed.data.action === "refund") {
      await refundOrderToWallet(order.id, parsed.data.reason, actor.id);
      return NextResponse.json({ ok: true, status: "refunded" });
    }

    // Manual fulfilment
    if (order.payment_status !== "paid") {
      return NextResponse.json({ error: "Cannot fulfil an unpaid order" }, { status: 400 });
    }

    const items = (order.items ?? []) as {
      id: string;
      product_id: string;
      category_slug: string;
      product_name: string;
      provider: string;
      duration_days: number;
    }[];

    for (const item of items) {
      const { data: product } = await admin
        .from("products")
        .select("metadata, setup_instructions, renewal_price_kobo, retail_price_kobo, default_supplier_id")
        .eq("id", item.product_id)
        .maybeSingle();

      const expiresAt =
        parsed.data.expiresAt ||
        new Date(Date.now() + item.duration_days * 24 * 60 * 60 * 1000).toISOString();

      await admin.from("customer_services").insert({
        user_id: order.user_id,
        order_id: order.id,
        order_item_id: item.id,
        product_id: item.product_id,
        supplier_id: product?.default_supplier_id ?? null,
        category_slug: item.category_slug,
        service_label: item.product_name,
        provider: item.provider,
        status: "active",
        credentials_encrypted: encryptJsonSecret(parsed.data.credentials),
        public_metadata: {
          ...(product?.metadata ?? {}),
          ...(parsed.data.publicMetadata ?? {}),
          setup_instructions: product?.setup_instructions ?? "",
        },
        starts_at: new Date().toISOString(),
        expires_at: expiresAt,
        renewal_price_kobo: product?.renewal_price_kobo ?? product?.retail_price_kobo ?? null,
      });

      await admin
        .from("order_fulfilments")
        .upsert(
          {
            order_id: order.id,
            order_item_id: item.id,
            fulfilment_mode: "manual",
            status: "delivered",
            fulfilled_by: actor.id,
            idempotency_key: `FULFILL-${order.id}-${item.id}`,
          },
          { onConflict: "idempotency_key" }
        );
    }

    await admin
      .from("orders")
      .update({ status: "delivered", fulfilled_at: new Date().toISOString() })
      .eq("id", order.id);

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "order.manual_fulfil",
      entityType: "order",
      entityId: order.id,
      afterState: { status: "delivered" },
    });

    await sendNotification({
      userId: order.user_id,
      type: "delivery_success",
      recipientEmail: order.customer_email,
      subject: `Your Digital Service is Ready - ${order.order_reference}`,
      bodyText: `Your order ${order.order_reference} has been delivered. Sign in to your Customer Dashboard to view your credentials.`,
      bodyHtml: `<p>Your order <strong>${order.order_reference}</strong> has been delivered. Sign in to your Customer Dashboard to access your service credentials.</p>`,
    });

    return NextResponse.json({ ok: true, status: "delivered" });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Order action failed" },
      { status: 500 }
    );
  }
}
