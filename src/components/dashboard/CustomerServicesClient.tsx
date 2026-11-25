"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { hasServiceSharedLogin, SHARED_LOGIN_BODY, SHARED_LOGIN_HEADING } from "@/lib/product-notices";
import { formatNaira } from "@/lib/utils";

interface CustomerServiceItem {
  id: string;
  order_id: string;
  category_slug: string;
  service_label: string;
  provider: string;
  status: string;
  credentials: Record<string, unknown>;
  public_metadata: Record<string, unknown>;
  starts_at: string;
  expires_at: string | null;
  renewal_price_kobo: number | null;
}

interface SmsMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  receivedAt: string;
}

export function CustomerServicesClient({
  category,
  title,
  emptyMessage,
}: {
  category: "vpn" | "proxy" | "uk-number";
  title: string;
  emptyMessage: string;
}) {
  const [services, setServices] = useState<CustomerServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [smsByService, setSmsByService] = useState<Record<string, SmsMessage[]>>({});

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/services?category=${encodeURIComponent(category)}`);
      const data = await res.json();
      setServices(data.services ?? []);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  async function copyText(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  }

  async function handleRenew(id: string) {
    setBusyId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/services/${id}/renew`, { method: "POST" });
      const data = await res.json();
      setNotice(data.message || data.error || "Renewal updated");
      await loadServices();
    } finally {
      setBusyId(null);
    }
  }

  async function handleSyncUsage(id: string) {
    setBusyId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/services/${id}/usage`);
      const data = await res.json();
      setNotice(data.message || data.error || (data.ok ? "Bandwidth usage synced" : "Usage API unavailable"));
      await loadServices();
    } finally {
      setBusyId(null);
    }
  }

  async function handleFetchSms(id: string) {
    setBusyId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/services/${id}/messages`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.messages)) {
        setSmsByService((prev) => ({ ...prev, [id]: data.messages }));
      } else {
        setNotice(data.message || data.error || "Inbound SMS API unavailable");
      }
    } finally {
      setBusyId(null);
    }
  }

  function exportProxyString(srv: CustomerServiceItem, format: "standard" | "url") {
    const c = srv.credentials;
    const host = String(c.host || c.ip || "");
    const port = String(c.port || "");
    const user = String(c.username || "");
    const pass = String(c.password || "");
    const proto = String(c.protocol || "http").toLowerCase();
    const content =
      format === "url"
        ? `${proto}://${user}:${pass}@${host}:${port}`
        : `${host}:${port}:${user}:${pass}`;
    const blob = new Blob([content + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proxy-${srv.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">
          Credentials are decrypted strictly for your authenticated session.
        </p>
      </div>

      {notice && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading services...
        </div>
      ) : services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0D1326] p-12 text-center text-sm text-slate-400">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-5">
          {services.map((srv) => {
            const c = srv.credentials || {};
            const m = srv.public_metadata || {};
            const isShared = hasServiceSharedLogin({
              label: srv.service_label,
              metadata: m,
              credentials: c,
            });
            return (
              <div key={srv.id} className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
                <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-semibold text-white">{srv.service_label}</h2>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          srv.status === "active"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : srv.status === "expiring_soon"
                              ? "bg-amber-500/10 text-amber-300"
                              : "bg-rose-500/10 text-rose-300"
                        }`}
                      >
                        {srv.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Provider: {srv.provider || "Managed"} • Started:{" "}
                      {new Date(srv.starts_at).toLocaleDateString()} • Expires:{" "}
                      {srv.expires_at ? new Date(srv.expires_at).toLocaleDateString() : "N/A"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {category === "proxy" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSyncUsage(srv.id)}
                          disabled={busyId === srv.id}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#070B19] px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-500"
                        >
                          <Activity className="h-3.5 w-3.5" /> Sync Usage
                        </button>
                        <button
                          type="button"
                          onClick={() => exportProxyString(srv, "standard")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#070B19] px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-500"
                        >
                          <Download className="h-3.5 w-3.5" /> Export host:port
                        </button>
                        <button
                          type="button"
                          onClick={() => exportProxyString(srv, "url")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#070B19] px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-500"
                        >
                          <Download className="h-3.5 w-3.5" /> Export URI
                        </button>
                      </>
                    )}

                    {category === "uk-number" && Boolean(m.sms_capable) && (
                      <button
                        type="button"
                        onClick={() => handleFetchSms(srv.id)}
                        disabled={busyId === srv.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#070B19] px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-500"
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> Check SMS Inbox
                      </button>
                    )}

                    {srv.renewal_price_kobo && (
                      <button
                        type="button"
                        onClick={() => handleRenew(srv.id)}
                        disabled={busyId === srv.id}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Renew ({formatNaira(srv.renewal_price_kobo)})
                      </button>
                    )}
                  </div>
                </div>

                {isShared && (
                  <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-100">
                    <p className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {SHARED_LOGIN_HEADING} — STRICTLY 1 USER (1 DEVICE)
                    </p>
                    <p className="mt-1 font-semibold leading-relaxed">{SHARED_LOGIN_BODY}</p>
                  </div>
                )}

                {/* Credentials Grid */}
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(c).map(([key, val]) => {
                    if (val === null || val === undefined || typeof val === "object") return null;
                    const strVal = String(val);
                    const copyId = `${srv.id}-${key}`;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wider text-slate-500">
                            {key.replace(/_/g, " ")}
                          </p>
                          <p className="truncate font-mono text-xs text-white">{strVal}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(copyId, strVal)}
                          className="ml-2 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                          aria-label={`Copy ${key}`}
                        >
                          {copiedKey === copyId ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Proxy Bandwidth Telemetry */}
                {category === "proxy" &&
                  (m.bandwidth_total_mb !== undefined || m.bandwidth_remaining_mb !== undefined) && (
                    <div className="mt-4 rounded-xl border border-slate-800 bg-[#070B19] p-4 text-xs text-slate-300">
                      Bandwidth Remaining:{" "}
                      <strong>
                        {m.bandwidth_remaining_mb !== undefined
                          ? `${m.bandwidth_remaining_mb} MB`
                          : "N/A"}
                      </strong>{" "}
                      {m.bandwidth_total_mb !== undefined && `/ ${m.bandwidth_total_mb} MB total`}
                    </div>
                  )}

                {/* UK Number Capabilities & Real SMS Inbox */}
                {category === "uk-number" && (
                  <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-md bg-slate-800 px-2.5 py-1 text-slate-300">
                        Type: {m.number_type === "temporary" ? "Temporary" : "Dedicated"}
                      </span>
                      <span className="rounded-md bg-slate-800 px-2.5 py-1 text-slate-300">
                        SMS: {m.sms_capable ? "Supported" : "Not Supported"}
                      </span>
                      <span className="rounded-md bg-slate-800 px-2.5 py-1 text-slate-300">
                        Voice: {m.voice_capable ? "Supported" : "Not Supported"}
                      </span>
                    </div>

                    {smsByService[srv.id] && (
                      <div className="rounded-xl border border-slate-800 bg-[#070B19] p-4">
                        <h3 className="text-xs font-semibold uppercase text-slate-400">
                          Inbound SMS Inbox
                        </h3>
                        {smsByService[srv.id].length === 0 ? (
                          <p className="mt-2 text-xs text-slate-500">No incoming SMS messages yet.</p>
                        ) : (
                          <div className="mt-2 space-y-2">
                            {smsByService[srv.id].map((msg) => (
                              <div key={msg.id} className="rounded-lg border border-slate-800 p-2.5 text-xs">
                                <div className="flex justify-between text-slate-400">
                                  <span>From: {msg.from}</span>
                                  <span>{new Date(msg.receivedAt).toLocaleString()}</span>
                                </div>
                                <p className="mt-1 text-white">{msg.body}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Setup Instructions & Config Links */}
                {typeof m.setup_instructions === "string" && m.setup_instructions && (
                  <div className="mt-4 rounded-xl border border-slate-800/80 bg-[#070B19] p-4 text-xs leading-relaxed text-slate-300 whitespace-pre-line">
                    <p className="mb-1 font-semibold text-white">Setup Instructions</p>
                    {m.setup_instructions}
                  </div>
                )}

                {Array.isArray(m.download_links) && m.download_links.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(m.download_links as { label: string; url: string }[]).map((dl) => (
                      <a
                        key={dl.url}
                        href={dl.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-blue-300 hover:border-blue-500"
                      >
                        <ExternalLink className="h-3 w-3" /> {dl.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
