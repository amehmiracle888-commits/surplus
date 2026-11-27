"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Globe,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { koboToNaira } from "@/lib/utils";
import { RESEARCH_DISCLAIMER_SHORT, RESEARCH_DISCLAIMER_TITLE } from "@/lib/product-notices";

export interface CatalogCountry {
  id: string;
  name: string;
}

export interface CatalogServiceItem {
  countryId: string;
  countryName: string;
  serviceCode: string;
  serviceName: string;
  count: number;
  retailPrice: number;
}

export interface ActivationRecord {
  id: string;
  activation_id: string;
  service_code: string;
  service_name: string;
  country_id: string;
  country_name: string;
  phone_number: string;
  retail_price: number;
  status: "pending" | "received" | "cancelled" | "expired";
  sms_code: string | null;
  sms_text: string | null;
  expires_at: string;
  created_at: string;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function formatCountdown(ms: number): string {
  const safeSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatNairaWhole(amount: number): string {
  return `₦${Number(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function VirtualNumbersClient({
  isAuthenticated,
  initialWalletKobo,
  initialActivations,
}: {
  isAuthenticated: boolean;
  initialWalletKobo: number | null;
  initialActivations: ActivationRecord[];
}) {
  const router = useRouter();
  const [countries, setCountries] = useState<CatalogCountry[]>([]);
  const [items, setItems] = useState<CatalogServiceItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  const [countryQuery, setCountryQuery] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [selectedServiceCode, setSelectedServiceCode] = useState<string>("");

  const [walletKobo, setWalletKobo] = useState<number | null>(initialWalletKobo);
  const [activations, setActivations] = useState<ActivationRecord[]>(initialActivations);
  const [activeActivationId, setActiveActivationId] = useState<string | null>(() => {
    const firstPending = initialActivations.find((a) => a.status === "pending");
    return firstPending?.activation_id ?? initialActivations[0]?.activation_id ?? null;
  });

  const [ordering, setOrdering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // 1-second ticker for live 20-min expiry and 5-min cancel cooldown
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch("/api/virtualsms/catalog");
      const data = await res.json();
      if (!res.ok) {
        setCatalogError(data.error || "Unable to load live numbers catalog.");
      }
      const list = (data.countries ?? []) as CatalogCountry[];
      setCountries(list);
      setItems((data.items ?? []) as CatalogServiceItem[]);
      setSelectedCountryId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? "";
      });
    } catch {
      setCatalogError("Network error while loading VirtualSMS catalog.");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const refreshActivations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch("/api/virtualsms/activations");
      if (!res.ok) return;
      const data = await res.json();
      setActivations(data.activations ?? []);
      if (typeof data.walletBalanceKobo === "number") {
        setWalletKobo(data.walletBalanceKobo);
      }
    } catch {
      // Ignore transient refresh failure
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const activeActivation = useMemo(
    () => activations.find((a) => a.activation_id === activeActivationId) ?? null,
    [activations, activeActivationId]
  );

  // Auto-poll every 5 seconds while an active activation is pending
  useEffect(() => {
    if (!isAuthenticated || !activeActivation || activeActivation.status !== "pending") {
      return;
    }

    let cancelled = false;

    async function pollStatus() {
      if (!activeActivation) return;
      try {
        const res = await fetch(
          `/api/virtualsms/status?id=${encodeURIComponent(activeActivation.activation_id)}`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const updated = data.activation as ActivationRecord | undefined;
        if (!updated || cancelled) return;

        setActivations((prev) =>
          prev.map((row) => (row.activation_id === updated.activation_id ? updated : row))
        );

        if (updated.status === "received") {
          setActionNotice(`OTP code received for ${updated.phone_number}!`);
        } else if (updated.status === "cancelled") {
          await refreshActivations();
        }
      } catch {
        // Ignore transient polling hiccups
      }
    }

    const intervalId = window.setInterval(pollStatus, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, activeActivation, refreshActivations]);

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => c.name.toLowerCase().includes(q) || c.id.includes(q));
  }, [countries, countryQuery]);

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCountryId && item.countryId !== selectedCountryId) return false;
      if (!q) return true;
      return (
        item.serviceName.toLowerCase().includes(q) ||
        item.serviceCode.toLowerCase().includes(q)
      );
    });
  }, [items, selectedCountryId, serviceQuery]);

  const selectedItem = useMemo(
    () =>
      filteredServices.find((s) => s.serviceCode === selectedServiceCode) ??
      items.find(
        (s) => s.countryId === selectedCountryId && s.serviceCode === selectedServiceCode
      ) ??
      null,
    [filteredServices, items, selectedCountryId, selectedServiceCode]
  );

  function copyValue(key: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  }

  async function handleGetNumber() {
    setActionError(null);
    setActionNotice(null);

    if (!isAuthenticated) {
      router.push("/login?redirect=/virtual-numbers");
      return;
    }

    if (!selectedItem) {
      setActionError("Please select a country and service first.");
      return;
    }

    setOrdering(true);
    try {
      const res = await fetch("/api/virtualsms/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryId: selectedItem.countryId,
          serviceCode: selectedItem.serviceCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Unable to purchase number.");
        return;
      }

      const created = data.activation as ActivationRecord;
      setActivations((prev) => [created, ...prev]);
      setActiveActivationId(created.activation_id);
      setActionNotice(
        `Number ${created.phone_number} provisioned! Polling every 5 seconds for your OTP.`
      );
      await refreshActivations();
    } catch {
      setActionError("Network error while purchasing number.");
    } finally {
      setOrdering(false);
    }
  }

  async function handleCancelAndRefund(activation: ActivationRecord) {
    setActionError(null);
    setActionNotice(null);
    setCancelling(true);
    try {
      const res = await fetch("/api/virtualsms/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activationId: activation.activation_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Unable to cancel this number.");
        return;
      }

      const updated = data.activation as ActivationRecord;
      setActivations((prev) =>
        prev.map((row) => (row.activation_id === updated.activation_id ? updated : row))
      );
      setActionNotice(
        `Activation cancelled and ${formatNairaWhole(updated.retail_price)} refunded to your wallet.`
      );
      await refreshActivations();
    } catch {
      setActionError("Network error while cancelling activation.");
    } finally {
      setCancelling(false);
    }
  }

  const cancelUnlockRemainingMs = activeActivation
    ? Math.max(0, new Date(activeActivation.created_at).getTime() + FIVE_MINUTES_MS - nowMs)
    : 0;
  const expiryRemainingMs = activeActivation
    ? Math.max(0, new Date(activeActivation.expires_at).getTime() - nowMs)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header & Wallet Strip */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0D1326] p-6 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 ring-1 ring-blue-500/25">
            <Phone className="h-3.5 w-3.5" />
            Live VirtualSMS OTP Delivery
          </div>
          <h1 className="mt-3 text-3xl font-bold text-white">Instant OTP Virtual Numbers</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-400">
            Select a country and platform to receive instant one-time verification SMS codes with live
            stock and automatic wallet refund protection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAuthenticated ? (
            <div className="rounded-xl border border-slate-800 bg-[#070B19] px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">Wallet Balance</p>
              <div className="mt-0.5 flex items-center gap-3">
                <span className="text-lg font-bold text-white">
                  {formatNairaWhole(koboToNaira(walletKobo ?? 0))}
                </span>
                <Link
                  href="/dashboard/wallet"
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600/20 px-2.5 py-1 text-xs font-medium text-blue-300 hover:bg-blue-600/30"
                >
                  <Wallet className="h-3.5 w-3.5" /> Fund
                </Link>
              </div>
            </div>
          ) : (
            <Link
              href="/login?redirect=/virtual-numbers"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
            >
              Sign In to Buy Numbers
            </Link>
          )}
        </div>
      </div>

      {catalogError && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="flex-1">
            <p className="font-medium">Catalog notice</p>
            <p className="mt-0.5 text-xs text-amber-100/90">{catalogError}</p>
          </div>
          <button
            type="button"
            onClick={loadCatalog}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/15"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {actionError}
        </div>
      )}

      {actionNotice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {actionNotice}
        </div>
      )}

      {/* Main Selector + Active OTP Panel Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Country & Service Selection */}
        <div className="space-y-6 lg:col-span-7">
          {/* Country Selector */}
          <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <Globe className="h-4 w-4 text-blue-400" />
                1. Choose Country
              </h2>
              {countries.length > 4 && (
                <div className="relative w-full sm:w-56">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={countryQuery}
                    onChange={(e) => setCountryQuery(e.target.value)}
                    placeholder="Filter countries..."
                    className="w-full rounded-lg border border-slate-800 bg-[#070B19] py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {catalogLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading countries...
                </div>
              ) : filteredCountries.length === 0 ? (
                <p className="text-xs text-slate-400">No enabled countries available right now.</p>
              ) : (
                filteredCountries.map((c) => {
                  const active = c.id === selectedCountryId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCountryId(c.id);
                        setSelectedServiceCode("");
                      }}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm"
                          : "border border-slate-800 bg-[#070B19] text-slate-300 hover:border-slate-600 hover:text-white"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Service Selector */}
          <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <MessageSquare className="h-4 w-4 text-violet-400" />
                2. Select App / Service
              </h2>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={serviceQuery}
                  onChange={(e) => setServiceQuery(e.target.value)}
                  placeholder="Search WhatsApp, Telegram, Google..."
                  className="w-full rounded-xl border border-slate-800 bg-[#070B19] py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
              {catalogLoading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading live prices and stock...
                </div>
              ) : filteredServices.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  No in-stock services match your search in this country.
                </p>
              ) : (
                filteredServices.map((svc) => {
                  const selected = svc.serviceCode === selectedServiceCode;
                  return (
                    <button
                      key={`${svc.countryId}-${svc.serviceCode}`}
                      type="button"
                      onClick={() => setSelectedServiceCode(svc.serviceCode)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                        selected
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-slate-800 bg-[#070B19] hover:border-slate-700"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{svc.serviceName}</p>
                        <div className="mt-1 flex items-center gap-2 text-[11px]">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono uppercase text-slate-400">
                            {svc.serviceCode}
                          </span>
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-300 ring-1 ring-emerald-500/20">
                            {svc.count.toLocaleString()} in stock
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-white">
                          {formatNairaWhole(svc.retailPrice)}
                        </p>
                        <p className="text-[11px] text-slate-400">One-time OTP</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-5 flex flex-col justify-between gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center">
              <div className="text-xs text-slate-400">
                {selectedItem ? (
                  <>
                    Selected:{" "}
                    <strong className="text-white">
                      {selectedItem.serviceName} ({selectedItem.countryName})
                    </strong>{" "}
                    • <strong className="text-blue-300">{formatNairaWhole(selectedItem.retailPrice)}</strong>
                  </>
                ) : (
                  "Choose an available service above to continue"
                )}
              </div>
              <button
                type="button"
                disabled={ordering || !selectedItem}
                onClick={handleGetNumber}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ordering ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Provisioning...
                  </>
                ) : !isAuthenticated ? (
                  "Sign In & Get Number"
                ) : (
                  <>
                    <Phone className="h-4 w-4" />
                    Get Number {selectedItem ? `(${formatNairaWhole(selectedItem.retailPrice)})` : ""}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Active Number & Live OTP Panel */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-semibold text-white">Active Number &amp; Live OTP</h2>
                <p className="text-xs text-slate-400">Auto-polls every 5 seconds for incoming SMS</p>
              </div>
              {activeActivation && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                    activeActivation.status === "received"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : activeActivation.status === "pending"
                        ? "bg-blue-500/15 text-blue-300"
                        : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {activeActivation.status}
                </span>
              )}
            </div>

            {!activeActivation ? (
              <div className="py-10 text-center text-sm text-slate-400">
                Purchase a virtual number on the left to view your live phone number and incoming OTP
                codes here.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {activeActivation.service_name} • {activeActivation.country_name}
                  </span>
                  <span className="font-mono">#{activeActivation.activation_id}</span>
                </div>

                {/* Copyable Phone Number */}
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#070B19] p-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">
                      Assigned Number
                    </p>
                    <p className="mt-1 font-mono text-xl font-bold tracking-wide text-white">
                      {activeActivation.phone_number}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyValue(`phone-${activeActivation.activation_id}`, activeActivation.phone_number)
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:border-blue-500"
                  >
                    {copiedKey === `phone-${activeActivation.activation_id}` ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </>
                    )}
                  </button>
                </div>

                {/* Live Countdown */}
                {activeActivation.status === "pending" && (
                  <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#070B19] px-4 py-3 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Clock className="h-3.5 w-3.5 text-blue-400" />
                      Time Remaining (20 min window)
                    </span>
                    <span className="font-mono text-sm font-bold text-blue-300">
                      {formatCountdown(expiryRemainingMs)}
                    </span>
                  </div>
                )}

                {/* Incoming OTP Box */}
                <div className="rounded-xl border border-slate-800 bg-[#070B19] p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Verification SMS / OTP Code
                  </p>
                  {activeActivation.status === "received" && activeActivation.sms_code ? (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-2xl font-bold tracking-wider text-emerald-300">
                          {activeActivation.sms_code}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copyValue(
                              `otp-${activeActivation.activation_id}`,
                              activeActivation.sms_code || ""
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25"
                        >
                          {copiedKey === `otp-${activeActivation.activation_id}` ? (
                            <>
                              <Check className="h-3.5 w-3.5" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" /> Copy OTP
                            </>
                          )}
                        </button>
                      </div>
                      {activeActivation.sms_text && (
                        <p className="rounded-lg bg-slate-900/90 p-2.5 text-xs text-slate-300">
                          {activeActivation.sms_text}
                        </p>
                      )}
                    </div>
                  ) : activeActivation.status === "pending" ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      Listening for incoming SMS code (polling every 5s)...
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">
                      No SMS received ({activeActivation.status}).
                    </p>
                  )}
                </div>

                {/* Cancel & Refund Button (5-minute rule) */}
                {activeActivation.status === "pending" && (
                  <button
                    type="button"
                    disabled={cancelling || cancelUnlockRemainingMs > 0}
                    onClick={() => handleCancelAndRefund(activeActivation)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-400"
                  >
                    {cancelling ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cancelling &amp; Refunding...
                      </>
                    ) : cancelUnlockRemainingMs > 0 ? (
                      <>
                        <Clock className="h-3.5 w-3.5" /> Cancel &amp; Refund available in{" "}
                        {formatCountdown(cancelUnlockRemainingMs)}
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" /> Cancel &amp; Refund (
                        {formatNairaWhole(activeActivation.retail_price)})
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-5 text-xs leading-relaxed text-slate-300">
            <p className="flex items-center gap-1.5 font-semibold text-white">
              <ShieldAlert className="h-4 w-4 text-blue-400" />
              {RESEARCH_DISCLAIMER_TITLE}
            </p>
            <p className="mt-1.5">
              {RESEARCH_DISCLAIMER_SHORT}{" "}
              <Link href="/terms" className="text-blue-400 hover:underline">
                View Terms of Service
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Order History */}
      {isAuthenticated && (
        <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Number Order History</h2>
            <button
              type="button"
              onClick={refreshActivations}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>

          {activations.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No virtual number orders yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 pr-4">Service</th>
                    <th className="py-2.5 pr-4">Country</th>
                    <th className="py-2.5 pr-4">Phone Number</th>
                    <th className="py-2.5 pr-4">OTP Code</th>
                    <th className="py-2.5 pr-4">Price</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5">Ordered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {activations.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setActiveActivationId(row.activation_id)}
                      className="cursor-pointer transition hover:bg-slate-900/60"
                    >
                      <td className="py-3 pr-4 font-medium text-white">{row.service_name}</td>
                      <td className="py-3 pr-4 text-slate-300">{row.country_name}</td>
                      <td className="py-3 pr-4 font-mono text-white">{row.phone_number}</td>
                      <td className="py-3 pr-4 font-mono font-bold text-emerald-300">
                        {row.sms_code || "—"}
                      </td>
                      <td className="py-3 pr-4 text-white">{formatNairaWhole(row.retail_price)}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                            row.status === "received"
                              ? "bg-emerald-500/10 text-emerald-300"
                              : row.status === "pending"
                                ? "bg-blue-500/10 text-blue-300"
                                : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
