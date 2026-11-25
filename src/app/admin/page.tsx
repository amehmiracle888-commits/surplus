import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatNaira } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [
    { count: totalCustomers },
    { data: orders },
    { data: services },
    { data: wallets },
    { data: auditLogs },
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("orders").select("id, status, payment_status, total_kobo, wholesale_cost_kobo, processing_fee_kobo"),
    admin.from("customer_services").select("id, status"),
    admin.from("wallets").select("balance_kobo"),
    admin.from("audit_logs").select("id, action, entity_type, created_at").order("created_at", { ascending: false }).limit(8),
  ]);

  const allOrders = orders ?? [];
  const paidOrders = allOrders.filter((o) => o.payment_status === "paid");
  const revenueKobo = paidOrders.reduce((s, o) => s + Number(o.total_kobo || 0), 0);
  const costKobo = paidOrders.reduce((s, o) => s + Number(o.wholesale_cost_kobo || 0), 0);
  const feeKobo = paidOrders.reduce((s, o) => s + Number(o.processing_fee_kobo || 0), 0);
  const profitKobo = revenueKobo - costKobo - feeKobo;

  const pendingPayments = allOrders.filter((o) => o.status === "pending_payment").length;
  const deliveredCount = allOrders.filter((o) => o.status === "delivered").length;
  const failedCount = allOrders.filter((o) => o.status === "failed").length;
  const activeServices = (services ?? []).filter((s) => s.status === "active" || s.status === "expiring_soon").length;
  const walletLiabilitiesKobo = (wallets ?? []).reduce((s, w) => s + Number(w.balance_kobo || 0), 0);

  const metrics = [
    { label: "Total Customers", value: String(totalCustomers ?? 0) },
    { label: "Total Orders", value: String(allOrders.length) },
    { label: "Gross Revenue", value: formatNaira(revenueKobo) },
    { label: "Net Profit", value: formatNaira(profitKobo) },
    { label: "Pending Payments", value: String(pendingPayments) },
    { label: "Successful Deliveries", value: String(deliveredCount) },
    { label: "Failed Orders", value: String(failedCount) },
    { label: "Active Subscriptions", value: String(activeServices) },
    { label: "Wallet Liabilities", value: formatNaira(walletLiabilitiesKobo) },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Administrator Overview</h1>
          <p className="mt-1 text-sm text-slate-400">
            Live financial, fulfilment, and subscription metrics across your reseller platform.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/products"
            className="rounded-xl border border-slate-700 bg-[#0D1326] px-4 py-2 text-xs font-semibold text-white"
          >
            Manage Products
          </Link>
          <Link
            href="/admin/orders"
            className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white"
          >
            Review Orders
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-2xl border border-slate-800 bg-[#0D1326] p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{m.label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
        <h2 className="text-base font-semibold text-white">Recent Audit Activity</h2>
        <div className="mt-4 space-y-2.5">
          {(auditLogs ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">No audit events recorded yet.</p>
          ) : (
            (auditLogs ?? []).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#070B19] px-4 py-2.5 text-xs"
              >
                <span className="font-mono text-slate-200">
                  {log.action} ({log.entity_type})
                </span>
                <span className="text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
