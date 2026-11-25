import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Package, ShoppingBag, Wallet } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatNaira } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  const user = await requireCustomer();
  const admin = createAdminClient();

  const [{ data: wallet }, { data: orders }, { data: services }, { data: walletTxs }] =
    await Promise.all([
      admin.from("wallets").select("balance_kobo").eq("user_id", user.id).maybeSingle(),
      admin
        .from("orders")
        .select("id, order_reference, status, payment_status, total_kobo, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      admin
        .from("customer_services")
        .select("id, service_label, category_slug, status, expires_at")
        .eq("user_id", user.id),
      admin
        .from("wallet_transactions")
        .select("id, entry_type, category, amount_kobo, reference, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const balanceKobo = Number(wallet?.balance_kobo ?? 0);
  const allServices = services ?? [];
  const activeCount = allServices.filter((s) => s.status === "active").length;
  const expiringCount = allServices.filter((s) => s.status === "expiring_soon").length;
  const totalOrdersCount = (orders ?? []).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome back{user.fullName ? `, ${user.fullName}` : ""}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage your wallet balance, active subscriptions, and order deliveries.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/wallet"
            className="rounded-xl border border-slate-700 bg-[#0D1326] px-4 py-2.5 text-sm font-medium text-white hover:border-slate-500"
          >
            Fund Wallet
          </Link>
          <Link
            href="/dashboard/browse"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white"
          >
            Browse Products <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase">Wallet Balance</span>
            <Wallet className="h-4 w-4 text-blue-400" />
          </div>
          <p className="mt-3 text-2xl font-bold text-white">{formatNaira(balanceKobo)}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase">Active Services</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-3 text-2xl font-bold text-white">{activeCount}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase">Expiring Soon</span>
            <AlertCircle className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-3 text-2xl font-bold text-white">{expiringCount}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase">Total Purchases</span>
            <ShoppingBag className="h-4 w-4 text-violet-400" />
          </div>
          <p className="mt-3 text-2xl font-bold text-white">{totalOrdersCount}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Recent Orders</h2>
            <Link href="/dashboard/orders" className="text-xs text-blue-400 hover:underline">
              View all
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {(orders ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-400">
                <Package className="mx-auto mb-2 h-6 w-6 text-slate-600" />
                No orders yet.
              </div>
            ) : (
              (orders ?? []).map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-[#070B19] px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-mono text-xs font-semibold text-white">{o.order_reference}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(o.created_at).toLocaleDateString()} • {o.status.replace(/_/g, " ")}
                    </p>
                  </div>
                  <p className="font-semibold text-white">{formatNaira(o.total_kobo)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Recent Wallet Transactions</h2>
            <Link href="/dashboard/transactions" className="text-xs text-blue-400 hover:underline">
              View all
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {(walletTxs ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-400">
                No wallet transactions recorded yet.
              </div>
            ) : (
              (walletTxs ?? []).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-[#070B19] px-4 py-3 text-sm"
                >
                  <div>
                    <p className="text-xs font-medium text-white">{tx.description || tx.category}</p>
                    <p className="font-mono text-[11px] text-slate-500">{tx.reference}</p>
                  </div>
                  <span
                    className={`font-semibold ${
                      tx.entry_type === "credit" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {tx.entry_type === "credit" ? "+" : "-"}
                    {formatNaira(tx.amount_kobo)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
