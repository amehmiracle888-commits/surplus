"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { formatNaira } from "@/lib/utils";

interface RenewableService {
  id: string;
  service_label: string;
  category_slug: string;
  status: string;
  expires_at: string | null;
  renewal_price_kobo: number | null;
}

interface RenewalRecord {
  id: string;
  amount_kobo: number;
  duration_days: number;
  status: string;
  new_expires_at: string | null;
  created_at: string;
}

export function RenewalsClient({
  services,
  renewals,
}: {
  services: RenewableService[];
  renewals: RenewalRecord[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function renew(id: string) {
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/services/${id}/renew`, { method: "POST" });
      const data = await res.json();
      setMessage(data.message || data.error || "Updated");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Subscription Renewals</h1>
        <p className="mt-1 text-sm text-slate-400">
          Renew active or expiring VPNs, proxies, and dedicated UK numbers using your wallet balance.
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {services.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-800 bg-[#0D1326] p-10 text-center text-sm text-slate-400">
            No renewable services found.
          </div>
        ) : (
          services.map((srv) => (
            <div
              key={srv.id}
              className="flex items-center justify-between rounded-2xl border border-slate-800 bg-[#0D1326] p-5"
            >
              <div>
                <h2 className="text-base font-semibold text-white">{srv.service_label}</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Status: {srv.status.replace(/_/g, " ")} • Expires:{" "}
                  {srv.expires_at ? new Date(srv.expires_at).toLocaleDateString() : "N/A"}
                </p>
              </div>
              {srv.renewal_price_kobo && (
                <button
                  type="button"
                  disabled={busyId === srv.id}
                  onClick={() => renew(srv.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  {busyId === srv.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {formatNaira(srv.renewal_price_kobo)}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
        <h2 className="text-base font-semibold text-white">Renewal History</h2>
        <div className="mt-4 space-y-2">
          {renewals.length === 0 ? (
            <p className="text-sm text-slate-400">No renewal requests yet.</p>
          ) : (
            renewals.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#070B19] px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-white">
                    {r.duration_days} Days Renewal ({r.status})
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="font-semibold text-white">{formatNaira(r.amount_kobo)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
