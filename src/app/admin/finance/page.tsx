"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { formatNaira } from "@/lib/utils";

interface FinanceSummary {
  grossRevenueKobo: number;
  supplierCostsKobo: number;
  processingFeesKobo: number;
  netProfitKobo: number;
  walletDepositsKobo: number;
  walletRefundsKobo: number;
  walletLiabilitiesKobo: number;
}

export default function AdminFinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [orders, setOrders] = useState<
    { id: string; order_reference: string; customer_email: string; total_kobo: number; wholesale_cost_kobo: number; status: string; created_at: string }[]
  >([]);

  useEffect(() => {
    fetch("/api/admin/finance")
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary ?? null);
        setOrders(d.orders ?? []);
      });
  }, []);

  const cards = summary
    ? [
        { label: "Gross Revenue", value: formatNaira(summary.grossRevenueKobo) },
        { label: "Supplier Costs", value: formatNaira(summary.supplierCostsKobo) },
        { label: "Processing Fees", value: formatNaira(summary.processingFeesKobo) },
        { label: "Net Profit", value: formatNaira(summary.netProfitKobo) },
        { label: "Wallet Deposits", value: formatNaira(summary.walletDepositsKobo) },
        { label: "Wallet Refunds", value: formatNaira(summary.walletRefundsKobo) },
        { label: "Wallet Liabilities", value: formatNaira(summary.walletLiabilitiesKobo) },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Financial Management</h1>
          <p className="mt-1 text-sm text-slate-400">
            Track gross revenue, wholesale supplier costs, Paystack fees, net profit, and wallet
            liabilities.
          </p>
        </div>
        <a
          href="/api/admin/finance?format=csv"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white"
        >
          <Download className="h-4 w-4" /> Export Transactions CSV
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-800 bg-[#0D1326] p-5">
            <p className="text-xs font-medium uppercase text-slate-400">{c.label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
        <h2 className="text-base font-semibold text-white">Order Margin Breakdown</h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
            <tr>
              <th className="py-3 pr-4">Reference</th>
              <th className="py-3 pr-4">Customer</th>
              <th className="py-3 pr-4">Revenue</th>
              <th className="py-3 pr-4">Wholesale Cost</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="py-3 pr-4 font-mono text-xs text-white">{o.order_reference}</td>
                <td className="py-3 pr-4 text-xs text-slate-300">{o.customer_email}</td>
                <td className="py-3 pr-4 font-semibold text-white">{formatNaira(o.total_kobo)}</td>
                <td className="py-3 pr-4 text-slate-300">{formatNaira(o.wholesale_cost_kobo)}</td>
                <td className="py-3 pr-4 capitalize text-slate-300">{o.status.replace(/_/g, " ")}</td>
                <td className="py-3 text-xs text-slate-400">
                  {new Date(o.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
