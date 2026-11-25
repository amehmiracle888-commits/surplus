"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

interface SettingRow {
  key: string;
  value: unknown;
  is_public: boolean;
}

const SETTING_LABELS: Record<string, string> = {
  branding: "Brand Name, Logo URL & Theme Colours",
  homepage: "Homepage Copy & Hero CTAs",
  contact: "Contact Details & WhatsApp Support Link",
  payment_limits: "Wallet Deposit Min / Max Limits (NGN)",
  banners: "Announcement Banner",
  social_links: "Social Media Links",
  faqs: "FAQs (JSON Array)",
  setup_guides: "Setup Guides / Knowledge Base (JSON Array)",
  policies: "Terms, Privacy & Refund Policies",
  email_config: "Email Notification Provider & Templates (Admin-Only)",
};

export default function AdminWebsitePage() {
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.settings ?? []) as SettingRow[];
        setSettings(list);
        const map: Record<string, string> = {};
        for (const item of list) {
          map[item.key] = JSON.stringify(item.value, null, 2);
        }
        setDrafts(map);
      });
  }, []);

  async function saveKey(key: string, isPublic: boolean) {
    setNotice(null);
    setSavingKey(key);
    try {
      const parsedValue = JSON.parse(drafts[key] || "{}");
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: parsedValue, is_public: isPublic }),
      });
      const data = await res.json();
      setNotice(data.error || `Saved "${key}" settings`);
    } catch {
      setNotice(`Invalid JSON in "${key}"`);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Website, Branding &amp; Notifications</h1>
        <p className="mt-1 text-sm text-slate-400">
          Edit storefront branding, homepage text, FAQs, setup guides, WhatsApp/contact details,
          policies, deposit limits, and email provider templates.
        </p>
      </div>

      {notice && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {notice}
        </div>
      )}

      <div className="space-y-5">
        {settings.map((s) => (
          <div key={s.key} className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {SETTING_LABELS[s.key] || s.key}
                </h2>
                <p className="font-mono text-xs text-slate-500">key: {s.key}</p>
              </div>
              <button
                type="button"
                disabled={savingKey === s.key}
                onClick={() => saveKey(s.key, s.is_public)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
              >
                {savingKey === s.key ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </button>
            </div>

            <textarea
              rows={7}
              value={drafts[s.key] ?? ""}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
              className="w-full rounded-xl border border-slate-800 bg-[#070B19] p-3.5 font-mono text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
