import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    const admin = createAdminClient();
    let query = admin
      .from("profiles")
      .select("*, wallet:wallets(balance_kobo), services:customer_services(id, status), orders(id, total_kobo, status)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (q) {
      query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ customers: data ?? [] });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load customers" }, { status: 500 });
  }
}
