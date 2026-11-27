"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Save, Search, Wallet } from "lucide-react";

interface CountryItem {
  id: string;
  name: string;
}

interface AdminActivationRow {
  id: string;
  activation_id: string;
  service_name: string;
  country_name: string;
  phone_number: string;
  wholesale_usd: number;
  retail_price: number;
  status: string;
  sms_code: string | null;
  created_at: string;
}

export default function AdminVirtualSmsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [balanceUsd, setBalanceUsd] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [availableCountries, setAvailableCountries] = useState<CountryItem[]>([]);
  const [activations, setActivations] = useState<AdminActivationRow[]>([]);

  const [usdToNgnRate, setUsdToNgnRate] = useState("1600");
  const [markupPercent, setMarkupPercent] = useState("40");
  const [flatFee, setFlatFee] = useState("0");
  const [enabledCountries, setEnabledCountries] = useState<CountryItem[]>([]);
  const [countrySearch, setCountrySearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/virtualsms");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load VirtualSMS settings");
        return;
      }

      setBalanceUsd(data.balanceUsd ?? null);
      setBalanceError(data.balanceError ?? null);
      setAvailableCountries(data.availableCountries ?? []);
      setActivations(data.activations ?? []);

      if (data.config) {
        setUsdToNgnRate(String(data.config.usd_to_ngn_rate ?? 1600));
        setMarkupPercent(String(data.config.markup_percent ?? 40));
        setFlatFee(String(data.config.flat_fee ?? 0));
        setEnabledCountries(data.config.enabled_countries ?? []);
      }
    } catch {
      setError("Network error loading VirtualSMS admin settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const previewRetailPrice = useMemo(() => {
    const rate = Number(usdToNgnRate) || 0;
    const markup = Number(markupPercent) || 0;
    const flat = Number(flatFee) || 0;
    return Math.ceil(0.5 * rate * (1 + markup / 100) + flat);
  }, [usdToNgnRate, markupPercent, flatFee]);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    const enabledSet = new Set(enabledCountries.map((c) => c.id));
    const merged = [...availableCountries];
    for (const ec of enabledCountries) {
      if (!merged.some((m) => m.id === ec.id)) {
        merged.unshift(ec);
      }
    }
    const list = q
      ? merged.filter((c) => c.name.toLowerCase().includes(q) || c.id.includes(q))
      : merged;
    return list.sort((a, b) => {
      const ae = enabledSet.has(a.id) ? 0 : 1;
      const be = enabledSet.has(b.id) ? 0 : 1;
      if (ae !== be) return ae - be;
      return a.name.localeCompare(b.name);
    });
  }, [availableCountries, enabledCountries, countrySearch]);

  function toggleCountry(country: CountryItem) {
    setEnabledCountries((prev) => {
      const exists = prev.some((c) => c.id === country.id);
      if (exists) {
        if (prev.length === 1) return prev; // Keep at least 1 enabled country
        return prev.filter((c) => c.id !== country.id);
      }
      return [...prev, country];
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/virtualsms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usd_to_ngn_rate: Number(usdToNgnRate),
          markup_percent: Number(markupPercent),
          flat_fee: Number(flatFee),
          enabled_countries: enabledCountries,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update pricing settings");
        return;
      }
      setNotice("VirtualSMS pricing & country settings saved.");
    } catch {
      setError("Network error saving settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">VirtualSMS Pricing &amp; OTP Monitor</h1>
          <p className="mt-1 text-sm text-slate-400">
            Configure USD-to-NGN exchange rate, percentage markup, flat fee, and enabled countries.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-[#0D1326] px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-500"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Live Balance
        </button>
      </div>

      {/* Live Master USD Balance */}
      <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">
              VirtualSMS Master Account Balance
            </p>
            {loading ? (
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking API...
              </div>
            ) : balanceUsd !== null ? (
              <p className="mt-1 text-3xl font-bold text-emerald-300">
                ${balanceUsd.toFixed(2)} <span className="text-base font-normal text-slate-400">USD</span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-300">
                {balanceError || "VIRTUALSMS_API_KEY not configured"}
              </p>
            )}
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
            <Wallet className="h-6 w-6" />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}

      {/* Pricing & Countries Form */}
      <form onSubmit={handleSave} className="space-y-6 rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
        <h2 className="text-lg font-semibold text-white">Dynamic Pricing &amp; Markup Settings</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-300">USD to NGN Rate (₦)</label>
            <input
              type="number"
              step="0.01"
              min="1"
              required
              value={usdToNgnRate}
              onChange={(e) => setUsdToNgnRate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Markup (%)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              required
              value={markupPercent}
              onChange={(e) => setMarkupPercent(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Flat Fee (₦)</label>
            <input
              type="number"
              step="1"
              min="0"
              required
              value={flatFee}
              onChange={(e) => setFlatFee(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-slate-300">
          Formula preview: A <strong className="text-white">$0.50 USD</strong> wholesale number sells
          for <strong className="text-blue-300">₦{previewRetailPrice.toLocaleString("en-NG")}</strong>{" "}
          (`Math.ceil((costUsd * rate) * (1 + markup/100) + flatFee)`).
        </div>

        <div className="space-y-3 border-t border-slate-800 pt-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Enabled Countries ({enabledCountries.length} selected)
              </h3>
              <p className="text-xs text-slate-400">
                Only checked countries appear on the customer OTP storefront.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Search countries..."
                className="w-full rounded-xl border border-slate-800 bg-[#070B19] py-2 pl-8 pr-3 text-xs text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCountries.map((country) => {
              const checked = enabledCountries.some((c) => c.id === country.id);
              return (
                <label
                  key={country.id}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs transition ${
                    checked
                      ? "border-blue-500/50 bg-blue-500/10 text-white"
                      : "border-slate-800 bg-[#070B19] text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <span className="truncate font-medium">
                    {country.name}{" "}
                    <span className="font-mono text-[10px] text-slate-500">({country.id})</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCountry(country)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600"
                  />
                </label>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Pricing Configuration
        </button>
      </form>

      {/* Recent Activations Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
        <h2 className="text-lg font-semibold text-white">Recent VirtualSMS Activations</h2>
        {activations.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No VirtualSMS activations recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-4">ID</th>
                  <th className="py-2 pr-4">Service</th>
                  <th className="py-2 pr-4">Country</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4">Wholesale</th>
                  <th className="py-2 pr-4">Retail</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">OTP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {activations.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 pr-4 font-mono text-slate-300">{row.activation_id}</td>
                    <td className="py-2.5 pr-4 text-white">{row.service_name}</td>
                    <td className="py-2.5 pr-4 text-slate-300">{row.country_name}</td>
                    <td className="py-2.5 pr-4 font-mono text-white">{row.phone_number}</td>
                    <td className="py-2.5 pr-4 text-slate-400">${Number(row.wholesale_usd).toFixed(3)}</td>
                    <td className="py-2.5 pr-4 font-semibold text-white">
                      ₦{Number(row.retail_price).toLocaleString("en-NG")}
                    </td>
                    <td className="py-2.5 pr-4 capitalize text-slate-300">{row.status}</td>
                    <td className="py-2.5 font-mono text-emerald-300">{row.sms_code || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
