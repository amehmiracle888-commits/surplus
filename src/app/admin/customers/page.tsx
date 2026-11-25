"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { formatNaira } from "@/lib/utils";

interface CustomerRow {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  is_suspended: boolean;
  created_at: string;
  wallet: { balance_kobo: number } | { balance_kobo: number }[] | null;
  orders: { id: string }[];
  services: { id: string; status: string }[];
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [entryType, setEntryType] = useState<"credit" | "debit">("credit");
  const [amountNaira, setAmountNaira] = useState("");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    const qs = search ? `?q=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/admin/customers${qs}`);
    const data = await res.json();
    setCustomers(data.customers ?? []);
  }, [search]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  function getBalance(w: CustomerRow["wallet"]): number {
    if (!w) return 0;
    if (Array.isArray(w)) return Number(w[0]?.balance_kobo ?? 0);
    return Number(w.balance_kobo ?? 0);
  }

  async function toggleSuspend(c: CustomerRow) {
    const action = c.is_suspended ? "restore" : "suspend";
    const body =
      action === "suspend"
        ? { action, reason: prompt("Suspension reason:") || "Suspended by administrator" }
        : { action };
    const res = await fetch(`/api/admin/customers/${c.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setNotice(data.error || `Account ${action}d`);
    await loadCustomers();
  }

  async function adjustWallet(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const res = await fetch(`/api/admin/customers/${selected.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "adjust_wallet",
        entryType,
        amountNaira: Number(amountNaira),
        reason,
      }),
    });
    const data = await res.json();
    setNotice(data.error || "Wallet balance adjusted via audited ledger entry");
    setSelected(null);
    setAmountNaira("");
    setReason("");
    await loadCustomers();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Customer Management</h1>
        <p className="mt-1 text-sm text-slate-400">
          Inspect customer balances, active services, suspend/restore accounts, and perform audited
          wallet adjustments.
        </p>
      </div>

      {notice && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {notice}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer by name or email..."
          className="w-full rounded-xl border border-slate-800 bg-[#0D1326] py-2.5 pl-10 pr-4 text-sm text-white"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0D1326]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-5 py-3.5">Customer</th>
              <th className="px-5 py-3.5">Wallet Balance</th>
              <th className="px-5 py-3.5">Orders</th>
              <th className="px-5 py-3.5">Active Services</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {customers.map((c) => (
              <tr key={c.id}>
                <td className="px-5 py-4">
                  <p className="font-medium text-white">{c.full_name || "Customer"}</p>
                  <p className="text-xs text-slate-400">{c.email}</p>
                </td>
                <td className="px-5 py-4 font-semibold text-white">
                  {formatNaira(getBalance(c.wallet))}
                </td>
                <td className="px-5 py-4 text-slate-300">{c.orders?.length ?? 0}</td>
                <td className="px-5 py-4 text-slate-300">
                  {(c.services ?? []).filter((s) => s.status === "active").length}
                </td>
                <td className="px-5 py-4 text-xs">
                  {c.is_suspended ? (
                    <span className="text-rose-400">Suspended</span>
                  ) : (
                    <span className="text-emerald-400">Active</span>
                  )}
                </td>
                <td className="px-5 py-4 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelected(c)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200"
                  >
                    Adjust Wallet
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSuspend(c)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-amber-300"
                  >
                    {c.is_suspended ? "Restore" : "Suspend"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form
            onSubmit={adjustWallet}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-[#0D1326] p-6"
          >
            <h2 className="text-lg font-bold text-white">Adjust Wallet: {selected.email}</h2>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as "credit" | "debit")}
              className="w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2.5 text-sm text-white"
            >
              <option value="credit">Credit (+)</option>
              <option value="debit">Debit (-)</option>
            </select>
            <input
              type="number"
              min={1}
              step="0.01"
              required
              value={amountNaira}
              onChange={(e) => setAmountNaira(e.target.value)}
              placeholder="Amount in NGN"
              className="w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white"
            />
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Audit reason..."
              className="w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Apply Ledger Entry
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
