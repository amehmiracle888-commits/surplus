import { NextResponse } from "next/server";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptJsonSecret } from "@/lib/crypto";

export async function GET(request: Request) {
  try {
    const user = await requireCustomer();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const admin = createAdminClient();
    let query = admin
      .from("customer_services")
      .select(
        "id, order_id, product_id, category_slug, service_label, provider, status, credentials_encrypted, public_metadata, external_service_id, starts_at, expires_at, auto_renew, renewal_price_kobo, last_usage_synced_at, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (category) {
      query = query.eq("category_slug", category);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const services = (data ?? []).map((row) => ({
      id: row.id,
      order_id: row.order_id,
      product_id: row.product_id,
      category_slug: row.category_slug,
      service_label: row.service_label,
      provider: row.provider,
      status: row.status,
      credentials: decryptJsonSecret<Record<string, unknown>>(row.credentials_encrypted) ?? {},
      public_metadata: row.public_metadata ?? {},
      starts_at: row.starts_at,
      expires_at: row.expires_at,
      auto_renew: row.auto_renew,
      renewal_price_kobo: row.renewal_price_kobo,
      last_usage_synced_at: row.last_usage_synced_at,
      created_at: row.created_at,
    }));

    return NextResponse.json({ services });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }
}
