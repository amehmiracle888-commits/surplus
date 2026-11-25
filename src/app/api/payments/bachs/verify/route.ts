import { NextResponse } from "next/server";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { settleBachsPayment } from "@/lib/payment-settlement";

export async function GET(request: Request) {
  try {
    const user = await requireCustomer();
    const { searchParams } = new URL(request.url);
    const ref = searchParams.get("reference") || searchParams.get("checkout_id");

    if (!ref) {
      return NextResponse.json({ error: "Missing transaction reference" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: tx } = await admin
      .from("payment_transactions")
      .select("user_id")
      .or(`reference.eq.${ref},provider_reference.eq.${ref}`)
      .maybeSingle();

    if (!tx || tx.user_id !== user.id) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const result = await settleBachsPayment(ref, "callback");
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bachs verification failed" },
      { status: 500 }
    );
  }
}
