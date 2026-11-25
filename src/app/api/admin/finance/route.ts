import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");

    const admin = createAdminClient();
    const [{ data: orders }, { data: payments }, { data: walletTxs }, { data: wallets }] =
      await Promise.all([
        admin
          .from("orders")
          .select("id, order_reference, customer_email, status, payment_status, payment_method, total_kobo, wholesale_cost_kobo, processing_fee_kobo, created_at")
          .order("created_at", { ascending: false }),
        admin
          .from("payment_transactions")
          .select("id, reference, purpose, channel, amount_kobo, fee_kobo, status, created_at")
          .order("created_at", { ascending: false }),
        admin
          .from("wallet_transactions")
          .select("id, user_id, entry_type, category, amount_kobo, reference, description, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        admin.from("wallets").select("balance_kobo"),
      ]);

    const paidOrders = (orders ?? []).filter((o) => o.payment_status === "paid");
    const grossRevenueKobo = paidOrders.reduce((sum, o) => sum + Number(o.total_kobo || 0), 0);
    const supplierCostsKobo = paidOrders.reduce((sum, o) => sum + Number(o.wholesale_cost_kobo || 0), 0);
    const processingFeesKobo = (payments ?? [])
      .filter((p) => p.status === "success")
      .reduce((sum, p) => sum + Number(p.fee_kobo || 0), 0);
    const netProfitKobo = grossRevenueKobo - supplierCostsKobo - processingFeesKobo;
    const walletLiabilitiesKobo = (wallets ?? []).reduce((sum, w) => sum + Number(w.balance_kobo || 0), 0);
    const walletDepositsKobo = (walletTxs ?? [])
      .filter((t) => t.category === "deposit" && t.entry_type === "credit")
      .reduce((sum, t) => sum + Number(t.amount_kobo || 0), 0);
    const walletRefundsKobo = (walletTxs ?? [])
      .filter((t) => t.category === "refund" && t.entry_type === "credit")
      .reduce((sum, t) => sum + Number(t.amount_kobo || 0), 0);

    if (format === "csv") {
      const header = "Type,Reference,Category/Method,Status,Amount_NGN,Fee_NGN,Created_At\n";
      const rows = [
        ...(orders ?? []).map((o) =>
          [
            "ORDER",
            o.order_reference,
            o.payment_method,
            o.status,
            (Number(o.total_kobo) / 100).toFixed(2),
            (Number(o.processing_fee_kobo || 0) / 100).toFixed(2),
            o.created_at,
          ].join(",")
        ),
        ...(walletTxs ?? []).map((t) =>
          [
            `WALLET_${t.entry_type.toUpperCase()}`,
            t.reference,
            t.category,
            "settled",
            (Number(t.amount_kobo) / 100).toFixed(2),
            "0.00",
            t.created_at,
          ].join(",")
        ),
      ].join("\n");

      return new NextResponse(header + rows, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="financial-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      summary: {
        grossRevenueKobo,
        supplierCostsKobo,
        processingFeesKobo,
        netProfitKobo,
        walletDepositsKobo,
        walletRefundsKobo,
        walletLiabilitiesKobo,
      },
      orders: orders ?? [],
      payments: payments ?? [],
      walletTransactions: walletTxs ?? [],
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load financial report" }, { status: 500 });
  }
}
