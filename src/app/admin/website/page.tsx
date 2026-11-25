"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Pencil, Plus, Save, Trash2 } from "lucide-react";

interface SettingRow {
  key: string;
  value: unknown;
  is_public: boolean;
}

interface DefaultEmailEntry {
  id: string;
  label: string;
  address: string;
  purpose: "support" | "transactional" | "billing" | "general";
  is_active: boolean;
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
  email_config: "System Transactional Email Provider & Templates (Admin-Only)",
};

export default function AdminWebsitePage() {
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [defaultEmails, setDefaultEmails] = useState<DefaultEmailEntry[]>([]);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [emailLabel, setEmailLabel] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [emailPurpose, setEmailPurpose] = useState<DefaultEmailEntry["purpose"]>("support");
  const [emailActive, setEmailActive] = useState(true);
  const [emailBusy, setEmailBusy] = useState(false);

  async function loadAll() {
    const [setRes, emRes] = await Promise.all([
      fetch("/api/admin/settings"),
      fetch("/api/admin/default-emails"),
    ]);
    const setData = await setRes.json();
    const emData = await emRes.json();

    const list = ((setData.settings ?? []) as SettingRow[]).filter(
      (s) => s.key !== "default_emails"
    );
    setSettings(list);
    const map: Record<string, string> = {};
    for (const item of list) {
      map[item.key] = JSON.stringify(item.value, null, 2);
    }
    setDrafts(map);
    setDefaultEmails(emData.emails ?? []);
  }

  useEffect(() => {
    loadAll();
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

  function startEditEmail(entry: DefaultEmailEntry) {
    setEditingEmailId(entry.id);
    setEmailLabel(entry.label);
    setEmailAddress(entry.address);
    setEmailPurpose(entry.purpose);
    setEmailActive(entry.is_active);
  }

  function resetEmailForm() {
    setEditingEmailId(null);
    setEmailLabel("");
    setEmailAddress("");
    setEmailPurpose("support");
    setEmailActive(true);
  }

  async function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setEmailBusy(true);
    try {
      const res = await fetch("/api/admin/default-emails", {
        method: editingEmailId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingEmailId ?? undefined,
          label: emailLabel,
          address: emailAddress,
          purpose: emailPurpose,
          is_active: emailActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || "Unable to save email address");
        return;
      }
      resetEmailForm();
      await loadAll();
      setNotice(editingEmailId ? "Default email address updated." : "Default email address added.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleDeleteEmail(entry: DefaultEmailEntry) {
    const confirmed = window.confirm(
      `Delete default email address "${entry.address}" (${entry.label})? Any public contact or reply-to references to this address will also be removed, while system transactional delivery remains intact.`
    );
    if (!confirmed) return;

    setNotice(null);
    setEmailBusy(true);
    try {
      const res = await fetch(`/api/admin/default-emails?id=${encodeURIComponent(entry.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || "Unable to delete email address");
        return;
      }
      if (editingEmailId === entry.id) resetEmailForm();
      await loadAll();
      setNotice(`Deleted "${entry.address}".`);
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Website, Branding &amp; Emails</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage default email addresses, website branding, homepage text, FAQs, setup guides,
          WhatsApp/contact details, policies, deposit limits, and transactional email templates.
        </p>
      </div>

      {notice && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {notice}
        </div>
      )}

      {/* Default Email Address Management */}
      <section className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Default Email Addresses</h2>
              <p className="text-xs text-slate-400">
                Add, edit, or delete default website email addresses. Deleting an address removes it
                from active use without breaking system transactional delivery.
              </p>
            </div>
          </div>
          {editingEmailId && (
            <button
              type="button"
              onClick={resetEmailForm}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSaveEmail} className="grid gap-3 rounded-xl border border-slate-800 bg-[#070B19] p-4 md:grid-cols-5">
          <input
            required
            value={emailLabel}
            onChange={(e) => setEmailLabel(e.target.value)}
            placeholder="Label (e.g., Support Desk)"
            className="rounded-lg border border-slate-800 bg-[#0D1326] px-3 py-2 text-xs text-white"
          />
          <input
            type="email"
            required
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            placeholder="email@example.com"
            className="rounded-lg border border-slate-800 bg-[#0D1326] px-3 py-2 text-xs text-white md:col-span-2"
          />
          <select
            value={emailPurpose}
            onChange={(e) => setEmailPurpose(e.target.value as DefaultEmailEntry["purpose"])}
            className="rounded-lg border border-slate-800 bg-[#0D1326] px-3 py-2 text-xs text-white"
          >
            <option value="support">Support</option>
            <option value="billing">Billing</option>
            <option value="transactional">Transactional</option>
            <option value="general">General</option>
          </select>
          <button
            type="submit"
            disabled={emailBusy}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
          >
            {emailBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {editingEmailId ? "Update Email" : "Add Email"}
          </button>
        </form>

        <div className="space-y-2.5">
          {defaultEmails.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-800 p-5 text-center text-xs text-slate-400">
              No default email addresses configured.
            </p>
          ) : (
            defaultEmails.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-[#070B19] px-4 py-3 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {entry.address}{" "}
                    <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] capitalize text-slate-300">
                      {entry.purpose}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400">{entry.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEditEmail(entry)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-blue-500"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEmail(entry)}
                    disabled={emailBusy}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

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
