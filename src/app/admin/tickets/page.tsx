"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";

interface AdminTicket {
  id: string;
  ticket_number: string;
  category: string;
  subject: string;
  priority: string;
  status: string;
  profile?: { email: string; full_name: string };
  messages: { id: string; sender_role: string; message: string; created_at: string }[];
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [replyByTicket, setReplyByTicket] = useState<Record<string, string>>({});

  async function loadTickets() {
    const res = await fetch("/api/admin/tickets");
    const data = await res.json();
    setTickets(data.tickets ?? []);
  }

  useEffect(() => {
    loadTickets();
  }, []);

  async function updateTicket(ticketId: string, payload: Record<string, unknown>) {
    await fetch("/api/admin/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, ...payload }),
    });
    setReplyByTicket((prev) => ({ ...prev, [ticketId]: "" }));
    await loadTickets();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Support Ticket Desk</h1>
        <p className="mt-1 text-sm text-slate-400">
          Respond to customers, assign priorities, and update ticket statuses.
        </p>
      </div>

      <div className="space-y-4">
        {tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0D1326] p-10 text-center text-sm text-slate-400">
            No support tickets submitted yet.
          </div>
        ) : (
          tickets.map((t) => (
            <div key={t.id} className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <span className="font-mono text-xs text-blue-400">{t.ticket_number}</span>
                  <h2 className="text-base font-semibold text-white">{t.subject}</h2>
                  <p className="text-xs text-slate-400">
                    {t.profile?.email} • {t.category}
                  </p>
                </div>

                <div className="flex gap-2">
                  <select
                    value={t.priority}
                    onChange={(e) => updateTicket(t.id, { priority: e.target.value })}
                    className="rounded-lg border border-slate-700 bg-[#070B19] px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <select
                    value={t.status}
                    onChange={(e) => updateTicket(t.id, { status: e.target.value })}
                    className="rounded-lg border border-slate-700 bg-[#070B19] px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="awaiting_customer">Awaiting Customer</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {(t.messages ?? []).map((m) => (
                  <div key={m.id} className="rounded-xl bg-[#070B19] p-3 text-xs text-slate-200">
                    <span className="font-semibold uppercase text-blue-400">{m.sender_role}: </span>
                    {m.message}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  value={replyByTicket[t.id] || ""}
                  onChange={(e) =>
                    setReplyByTicket((prev) => ({ ...prev, [t.id]: e.target.value }))
                  }
                  placeholder="Write admin response..."
                  className="flex-1 rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={() => updateTicket(t.id, { replyMessage: replyByTicket[t.id] || "" })}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  <Send className="h-3.5 w-3.5" /> Send Reply
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
