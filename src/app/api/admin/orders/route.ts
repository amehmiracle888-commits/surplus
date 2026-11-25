import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("payment_status");
    const category = searchParams.get("category");

    const admin = createAdminClient();
    let query = admin
      .from("orders")
      .select(
        "*, items:order_items(*), fulfilments:order_fulfilments(*)"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (status) query = query.eq("status", status);
    if (paymentStatus) query = query.eq("payment_status", paymentStatus);
    if (q) {
      query = query.or(`order_reference.ilike.%${q}%,customer_email.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let orders = data ?? [];
    if (category) {
      orders = orders.filter((o) =>
        (o.items as { category_slug: string }[])?.some((item) => item.category_slug === category)
      );
    }

    return NextResponse.json({ orders });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}
