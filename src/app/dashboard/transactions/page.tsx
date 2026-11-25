import { requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatNaira } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const user = await requireCustomer();
  const admin = createAdminClient();

  const [{ data: payments }, { data: walletTxs }] = await Promise.all([
    admin
      .from("payment_transactions")
      .select("id, reference, purpose, channel, amount_kobo, status, verified_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("wallet_transactions")
      .select("id, entry_type, category, amount_kobo, balance_after_kobo, reference, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Transactions</h1>
        <p className="mt-1 text-sm text-slate-400">
          Complete history of your Paystack payments and auditable wallet ledger entries.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
        <h2 className="text-base font-semibold text-white">Online Payment Transactions (Bachs.io)</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
              <tr>
                <th className="py-3 pr-4">Reference</th>
                <th className="py-3 pr-4">Purpose</th>
                <th className="py-3 pr-4">Channel</th>
                <th className="py-3 pr-4">Amount</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {(payments ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No Paystack payments recorded yet.
                  </td>
                </tr>
              ) : (
                (payments ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 pr-4 font-mono text-xs text-white">{p.reference}</td>
                    <td className="py-3 pr-4 capitalize text-slate-300">
                      {p.purpose.replace(/_/g, " ")}
                    </td>
                    <td className="py-3 pr-4 capitalize text-slate-300">{p.channel || "card"}</td>
                    <td className="py-3 pr-4 font-semibold text-white">
                      {formatNaira(p.amount_kobo)}
                    </td>
                    <td className="py-3 pr-4 capitalize text-slate-200">{p.status}</td>
                    <td className="py-3 text-xs text-slate-400">
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
        <h2 className="text-base font-semibold text-white">Wallet Ledger Entries</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
              <tr>
                <th className="py-3 pr-4">Reference</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Description</th>
                <th className="py-3 pr-4">Amount</th>
                <th className="py-3 pr-4">Balance After</th>
                <th className="py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {(walletTxs ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No wallet ledger entries yet.
                  </td>
                </tr>
              ) : (
                (walletTxs ?? []).map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-3 pr-4 font-mono text-xs text-white">{tx.reference}</td>
                    <td className="py-3 pr-4 capitalize text-slate-300">
                      {tx.entry_type} ({tx.category})
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{tx.description}</td>
                    <td
                      className={`py-3 pr-4 font-semibold ${
                        tx.entry_type === "credit" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {tx.entry_type === "credit" ? "+" : "-"}
                      {formatNaira(tx.amount_kobo)}
                    </td>
                    <td className="py-3 pr-4 text-slate-200">
                      {formatNaira(tx.balance_after_kobo)}
                    </td>
                    <td className="py-3 text-xs text-slate-400">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
