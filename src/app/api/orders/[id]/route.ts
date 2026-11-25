import { NextResponse } from "next/server";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptJsonSecret } from "@/lib/crypto";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCustomer();
    const { id } = await context.params;
    const admin = createAdminClient();

    const { data: order, error } = await admin
      .from("orders")
      .select(
        "id, order_reference, user_id, status, payment_status, payment_method, payment_reference, subtotal_kobo, discount_kobo, processing_fee_kobo, total_kobo, customer_email, notes, paid_at, fulfilled_at, created_at, updated_at"
      )
      .eq("id", id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.user_id !== user.id && user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const [{ data: items }, { data: services }] = await Promise.all([
      admin
        .from("order_items")
        .select(
          "id, product_id, category_slug, product_name, provider, quantity, unit_price_kobo, total_price_kobo, duration_days, selected_options, created_at"
        )
        .eq("order_id", order.id),
      admin
        .from("customer_services")
        .select(
          "id, service_label, provider, category_slug, status, credentials_encrypted, public_metadata, starts_at, expires_at"
        )
        .eq("order_id", order.id)
        .eq("user_id", order.user_id),
    ]);

    const decryptedServices = (services ?? []).map((srv) => ({
      id: srv.id,
      service_label: srv.service_label,
      provider: srv.provider,
      category_slug: srv.category_slug,
      status: srv.status,
      credentials: decryptJsonSecret<Record<string, unknown>>(srv.credentials_encrypted) ?? {},
      public_metadata: srv.public_metadata,
      starts_at: srv.starts_at,
      expires_at: srv.expires_at,
    }));

    return NextResponse.json({ order, items: items ?? [], services: decryptedServices });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}
