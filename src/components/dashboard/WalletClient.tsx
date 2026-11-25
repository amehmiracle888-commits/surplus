"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Loader2, PlusCircle, Wallet } from "lucide-react";
import { formatNaira } from "@/lib/utils";

interface WalletTx {
  id: string;
  entry_type: "credit" | "debit";
  category: string;
  amount_kobo: number;
  balance_after_kobo: number;
  reference: string;
  description: string;
  created_at: string;
}

export function WalletClient({
  balanceKobo,
  minDepositNaira,
  maxDepositNaira,
  transactions,
  verifyReference,
}: {
  balanceKobo: number;
  minDepositNaira: number;
  maxDepositNaira: number;
  transactions: WalletTx[];
  verifyReference?: string;
}) {
  const router = useRouter();
  const [amountNaira, setAmountNaira] = useState(String(Math.max(1000, minDepositNaira)));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!verifyReference) return;
    fetch(`/api/payments/bachs/verify?reference=${encodeURIComponent(verifyReference)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.settled) {
          setMessage(data.message || "Wallet credited successfully");
          router.refresh();
        } else {
          setError(data.message || data.error || "Payment verification did not succeed");
        }
      })
      .catch(() => setError("Unable to verify Bachs.io transaction"));
  }, [verifyReference, router]);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const num = Number(amountNaira);
    if (!Number.isFinite(num) || num < minDepositNaira || num > maxDepositNaira) {
      setError(
        `Enter an amount between ₦${minDepositNaira.toLocaleString()} and ₦${maxDepositNaira.toLocaleString()}`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payments/bachs/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "wallet_deposit",
          amountNaira: num,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start Bachs.io checkout");
        setLoading(false);
        return;
      }
      window.location.href = data.checkout_url;
    } catch {
      setError("Network error while contacting payment server");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Customer Wallet (₦)</h1>
        <p className="mt-1 text-sm text-slate-400">
          Fund your Naira wallet via Bachs.io (Cards, NGN Bank Transfer, Mobile Money, Crypto) and
          pay instantly at checkout. Balances update only after backend verification.
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-[#0E1733] to-[#121633] p-6 lg:col-span-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-blue-300">
            <Wallet className="h-4 w-4" /> Available Balance
          </div>
          <p className="mt-3 text-4xl font-bold text-white">{formatNaira(balanceKobo)}</p>
          <p className="mt-2 text-xs text-slate-400">
            Deposit limits: ₦{minDepositNaira.toLocaleString()} – ₦{maxDepositNaira.toLocaleString()}
          </p>

          <form onSubmit={handleDeposit} className="mt-6 space-y-4 border-t border-slate-800 pt-5">
            <div>
              <label className="block text-xs font-medium text-slate-300">Deposit Amount (₦)</label>
              <input
                type="number"
                min={minDepositNaira}
                max={maxDepositNaira}
                value={amountNaira}
                onChange={(e) => setAmountNaira(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Deposit via Bachs.io
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6 lg:col-span-7">
          <h2 className="text-base font-semibold text-white">Wallet Ledger History</h2>
          <div className="mt-4 space-y-3">
            {transactions.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                No wallet ledger entries yet.
              </p>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-[#070B19] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        tx.entry_type === "credit"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {tx.entry_type === "credit" ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {tx.description || tx.category}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {tx.reference} • {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
                        tx.entry_type === "credit" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {tx.entry_type === "credit" ? "+" : "-"}
                      {formatNaira(tx.amount_kobo)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Bal: {formatNaira(tx.balance_after_kobo)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
