import { NextResponse } from "next/server";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const SAFE_ACTIVATION_COLUMNS =
  "id, user_id, activation_id, service_code, service_name, country_id, country_name, phone_number, retail_price, status, sms_code, sms_text, expires_at, created_at";

export async function GET() {
  try {
    const user = await requireCustomer();
    const admin = createAdminClient();

    const [{ data: activations, error }, { data: wallet }] = await Promise.all([
      admin
        .from("sms_activations")
        .select(SAFE_ACTIVATION_COLUMNS)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      admin.from("wallets").select("balance_kobo").eq("user_id", user.id).maybeSingle(),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      activations: activations ?? [],
      walletBalanceKobo: Number(wallet?.balance_kobo ?? 0),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to load activations" }, { status: 500 });
  }
}
