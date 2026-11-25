"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CreditCard, Loader2, Lock, ShieldAlert, Wallet } from "lucide-react";
import {
  isSharedOptionSelected,
  RESEARCH_DISCLAIMER_SHORT,
  RESEARCH_DISCLAIMER_TITLE,
  SHARED_LOGIN_BODY,
  SHARED_LOGIN_HEADING,
  STRICT_USER_LIMIT_LONG,
} from "@/lib/product-notices";
import { formatNaira } from "@/lib/utils";
import type { PublicProduct } from "@/types/database";

interface CheckoutPanelProps {
  product: PublicProduct;
  isAuthenticated: boolean;
  walletBalanceKobo: number | null;
}

export function CheckoutPanel({ product, isAuthenticated, walletBalanceKobo }: CheckoutPanelProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const opt of product.options_schema ?? []) {
      if (opt.options && opt.options.length > 0) {
        initial[opt.key] = opt.options[0].value;
      }
    }
    return initial;
  });
  const [paymentMethod, setPaymentMethod] = useState<"bachs" | "wallet">("bachs");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUnavailable =
    product.availability_status === "out_of_stock" || product.availability_status === "discontinued";

  const unitPriceKobo = useMemo(() => {
    let delta = 0;
    for (const opt of product.options_schema ?? []) {
      const val = selectedOptions[opt.key];
      const match = opt.options?.find((o) => o.value === val);
      if (match?.price_delta_kobo) delta += match.price_delta_kobo;
    }
    return Math.max(0, product.retail_price_kobo + delta);
  }, [product, selectedOptions]);

  const totalKobo = unitPriceKobo * quantity;
  const sufficientWallet = walletBalanceKobo !== null && walletBalanceKobo >= totalKobo;
  const { offersShared, selectedIsShared } = isSharedOptionSelected(product, selectedOptions);

  async function handleCheckout() {
    setError(null);
    if (!isAuthenticated) {
      router.push(`/login?redirect=/products/${product.slug}`);
      return;
    }

    setLoading(true);
    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? `CHK-${crypto.randomUUID()}`
          : `CHK-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const res = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          selectedOptions,
          paymentMethod,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to complete checkout");
        setLoading(false);
        return;
      }

      if (paymentMethod === "bachs" && data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      router.push(`/dashboard/orders?highlight=${encodeURIComponent(data.orderReference || "")}`);
      router.refresh();
    } catch {
      setError("Network error during checkout. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6 shadow-xl">
      <div className="flex items-baseline justify-between border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-400">Price (NGN)</p>
          <p className="mt-1 text-3xl font-bold text-white">{formatNaira(totalKobo)}</p>
        </div>
        <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 ring-1 ring-blue-500/25">
          {product.delivery_method === "automated" ? "Automated Delivery" : "Manual Fulfilment"}
        </span>
      </div>

      <p className="mt-3 text-xs font-semibold text-blue-300">
        License Limit: {STRICT_USER_LIMIT_LONG}
      </p>

      <div className="mt-5 space-y-4">
        {(product.options_schema ?? []).map((opt) => (
          <div key={opt.key}>
            <label className="block text-xs font-medium text-slate-300">{opt.label}</label>
            {opt.type === "select" && opt.options ? (
              <select
                value={selectedOptions[opt.key] || ""}
                onChange={(e) => setSelectedOptions((prev) => ({ ...prev, [opt.key]: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                {opt.options.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                    {choice.price_delta_kobo
                      ? ` (+${formatNaira(choice.price_delta_kobo)})`
                      : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={opt.type === "number" ? "number" : "text"}
                value={selectedOptions[opt.key] || ""}
                onChange={(e) => setSelectedOptions((prev) => ({ ...prev, [opt.key]: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            )}
          </div>
        ))}

        <div>
          <label className="block text-xs font-medium text-slate-300">Quantity</label>
          <input
            type="number"
            min={1}
            max={product.stock_quantity ?? 20}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="space-y-2 pt-2">
          <label className="block text-xs font-medium text-slate-300">Payment Method</label>
          <button
            type="button"
            onClick={() => setPaymentMethod("bachs")}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
              paymentMethod === "bachs"
                ? "border-blue-500 bg-blue-500/10 text-white"
                : "border-slate-800 bg-[#070B19] text-slate-300 hover:border-slate-700"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <CreditCard className="h-4 w-4 text-blue-400" />
              Bachs.io Checkout (Card, NGN Bank Transfer, Crypto)
            </span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod("wallet")}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
              paymentMethod === "wallet"
                ? "border-violet-500 bg-violet-500/10 text-white"
                : "border-slate-800 bg-[#070B19] text-slate-300 hover:border-slate-700"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Wallet className="h-4 w-4 text-violet-400" />
              Account Wallet
            </span>
            {isAuthenticated && walletBalanceKobo !== null && (
              <span className={sufficientWallet ? "text-xs text-emerald-400" : "text-xs text-amber-400"}>
                {formatNaira(walletBalanceKobo)}
              </span>
            )}
          </button>
        </div>

        {offersShared && selectedIsShared && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            <p className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {SHARED_LOGIN_HEADING}
            </p>
            <p className="mt-1 font-semibold leading-relaxed">{SHARED_LOGIN_BODY}</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={loading || isUnavailable}
          onClick={handleCheckout}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : isUnavailable ? (
            "Currently Out of Stock"
          ) : !isAuthenticated ? (
            <>
              <Lock className="h-4 w-4" />
              Sign In to Purchase
            </>
          ) : (
            `Pay ${formatNaira(totalKobo)}`
          )}
        </button>

        {isAuthenticated && paymentMethod === "wallet" && !sufficientWallet && (
          <p className="text-center text-xs text-slate-400">
            Need more balance?{" "}
            <Link href="/dashboard/wallet" className="text-blue-400 hover:underline">
              Fund your wallet via Bachs.io
            </Link>
          </p>
        )}

        <div className="rounded-xl border border-slate-800 bg-[#070B19] p-3.5 text-[11px] leading-relaxed text-slate-400">
          <p className="flex items-center gap-1.5 font-semibold text-slate-200">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            {RESEARCH_DISCLAIMER_TITLE}
          </p>
          <p className="mt-1">
            {RESEARCH_DISCLAIMER_SHORT}{" "}
            <Link href="/terms" className="text-blue-400 hover:underline">
              View Terms of Service
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
