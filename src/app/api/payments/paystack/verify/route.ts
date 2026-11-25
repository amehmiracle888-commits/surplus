import { NextResponse } from "next/server";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { settlePaystackPayment } from "@/lib/payment-settlement";

export async function GET(request: Request) {
  try {
    const user = await requireCustomer();
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get("reference") || searchParams.get("trxref");

    if (!reference) {
      return NextResponse.json({ error: "Missing transaction reference" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: tx } = await admin
      .from("payment_transactions")
      .select("user_id")
      .eq("reference", reference)
      .maybeSingle();

    if (!tx || tx.user_id !== user.id) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const result = await settlePaystackPayment(reference, "callback");
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payment verification failed" },
      { status: 500 }
    );
  }
}
