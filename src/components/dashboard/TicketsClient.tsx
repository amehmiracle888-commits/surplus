"use client";

import { useState } from "react";
import { Loader2, Paperclip, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface TicketItem {
  id: string;
  ticket_number: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  messages: {
    id: string;
    sender_role: string;
    message: string;
    attachments: { name: string; path: string }[];
    created_at: string;
  }[];
}

export function TicketsClient({
  userId,
  initialTickets,
  orders,
}: {
  userId: string;
  initialTickets: TicketItem[];
  orders: { id: string; order_reference: string }[];
}) {
  const [tickets, setTickets] = useState<TicketItem[]>(initialTickets);
  const [category, setCategory] = useState("order_issue");
  const [orderId, setOrderId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [replyByTicket, setReplyByTicket] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function refreshTickets() {
    const res = await fetch("/api/support/tickets");
    const data = await res.json();
    if (res.ok) setTickets(data.tickets ?? []);
  }

  async function uploadScreenshot(targetFile: File) {
    const supabase = createClient();
    const safeName = targetFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from("support-attachments").upload(path, targetFile);
    if (upErr) throw new Error(upErr.message);
    return { name: targetFile.name, path, mime_type: targetFile.type, size: targetFile.size };
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const attachments = file ? [await uploadScreenshot(file)] : [];
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject,
          orderId: orderId || null,
          message,
          attachments,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create ticket");
        setSubmitting(false);
        return;
      }
      setSubject("");
      setMessage("");
      setOrderId("");
      setFile(null);
      await refreshTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit ticket");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply(ticketId: string) {
    const text = replyByTicket[ticketId]?.trim();
    if (!text) return;
    await fetch(`/api/support/tickets/${ticketId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    setReplyByTicket((prev) => ({ ...prev, [ticketId]: "" }));
    await refreshTickets();
  }

  async function handleClose(ticketId: string) {
    await fetch(`/api/support/tickets/${ticketId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ close: true }),
    });
    await refreshTickets();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Support Tickets</h1>
        <p className="mt-1 text-sm text-slate-400">
          Open a support ticket, attach screenshots, and track responses from our operations team.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleCreateTicket}
          className="space-y-4 rounded-2xl border border-slate-800 bg-[#0D1326] p-6 lg:col-span-5"
        >
          <h2 className="text-base font-semibold text-white">Open New Ticket</h2>

          <div>
            <label className="block text-xs font-medium text-slate-300">Issue Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white"
            >
              <option value="order_issue">Order &amp; Delivery Issue</option>
              <option value="payment_wallet">Payment / Wallet Deposit</option>
              <option value="vpn_setup">VPN Subscription Help</option>
              <option value="proxy_issue">Proxy Connection / Bandwidth</option>
              <option value="uk_number_issue">UK Virtual Number</option>
              <option value="account">Account Access</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">
              Order Reference (Optional)
            </label>
            <select
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white"
            >
              <option value="">None</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_reference}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of the issue"
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Description</label>
            <textarea
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Provide all relevant details..."
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">
              Screenshot Attachment (Optional)
            </label>
            <label className="mt-1.5 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-700 bg-[#070B19] px-3.5 py-2.5 text-xs text-slate-300 hover:border-blue-500">
              <Paperclip className="h-4 w-4 text-slate-400" />
              <span>{file ? file.name : "Choose PNG/JPG screenshot"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-3 text-sm font-semibold text-white"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Ticket
          </button>
        </form>

        <div className="space-y-4 lg:col-span-7">
          {tickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0D1326] p-10 text-center text-sm text-slate-400">
              You have no support tickets yet.
            </div>
          ) : (
            tickets.map((t) => (
              <div key={t.id} className="rounded-2xl border border-slate-800 bg-[#0D1326] p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <span className="font-mono text-xs text-blue-400">{t.ticket_number}</span>
                    <h3 className="text-base font-semibold text-white">{t.subject}</h3>
                    <p className="text-xs capitalize text-slate-400">
                      {t.category.replace(/_/g, " ")} • Status: {t.status.replace(/_/g, " ")}
                    </p>
                  </div>
                  {t.status !== "closed" && (
                    <button
                      type="button"
                      onClick={() => handleClose(t.id)}
                      className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500"
                    >
                      Close Ticket
                    </button>
                  )}
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto">
                  {(t.messages ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-xl p-3 text-xs ${
                        m.sender_role === "admin"
                          ? "border border-blue-500/20 bg-blue-500/10 text-slate-100"
                          : "bg-[#070B19] text-slate-300"
                      }`}
                    >
                      <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                        <span className="font-semibold uppercase">
                          {m.sender_role === "admin" ? "Support Team" : "You"}
                        </span>
                        <span>{new Date(m.created_at).toLocaleString()}</span>
                      </div>
                      <p className="whitespace-pre-line">{m.message}</p>
                    </div>
                  ))}
                </div>

                {t.status !== "closed" && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyByTicket[t.id] || ""}
                      onChange={(e) =>
                        setReplyByTicket((prev) => ({ ...prev, [t.id]: e.target.value }))
                      }
                      placeholder="Write a reply..."
                      className="flex-1 rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2 text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleReply(t.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                    >
                      <Send className="h-3.5 w-3.5" /> Reply
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
