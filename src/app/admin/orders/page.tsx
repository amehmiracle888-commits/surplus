"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Search, Send, Undo2 } from "lucide-react";
import { formatNaira } from "@/lib/utils";

interface AdminOrderRow {
  id: string;
  order_reference: string;
  customer_email: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_kobo: number;
  wholesale_cost_kobo: number;
  created_at: string;
  items: { product_name: string; category_slug: string; quantity: number }[];
  fulfilments: {
    id: string;
    status: string;
    fulfilment_mode: string;
    error_message: string | null;
    supplier_response: Record<string, unknown>;
  }[];
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderRow | null>(null);
  const [credentialsJson, setCredentialsJson] = useState(
    '{\n  "username": "",\n  "password": ""\n}'
  );
  const [refundReason, setRefundReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search) qs.set("q", search);
      if (statusFilter) qs.set("status", statusFilter);
      if (categoryFilter) qs.set("category", categoryFilter);
      const res = await fetch(`/api/admin/orders?${qs.toString()}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function retryOrder(orderId: string) {
    setActionBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry" }),
      });
      const data = await res.json();
      setNotice(data.message || data.error || "Retry executed");
      await loadOrders();
    } finally {
      setActionBusy(false);
    }
  }

  async function manualFulfil(orderId: string) {
    setActionBusy(true);
    setNotice(null);
    try {
      const credentials = JSON.parse(credentialsJson);
      const res = await fetch(`/api/admin/orders/${orderId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manual_fulfil", credentials }),
      });
      const data = await res.json();
      setNotice(data.error || "Order manually delivered");
      setSelectedOrder(null);
      await loadOrders();
    } catch {
      setNotice("Invalid JSON credentials");
    } finally {
      setActionBusy(false);
    }
  }

  async function refundOrder(orderId: string) {
    if (!refundReason.trim()) {
      setNotice("Enter a refund reason");
      return;
    }
    setActionBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refund", reason: refundReason.trim() }),
      });
      const data = await res.json();
      setNotice(data.error || "Order refunded to customer wallet");
      setRefundReason("");
      setSelectedOrder(null);
      await loadOrders();
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Order Management</h1>
        <p className="mt-1 text-sm text-slate-400">
          Inspect supplier responses, manually fulfil orders, retry failed API calls, or refund to
          wallet.
        </p>
      </div>

      {notice && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {notice}
        </div>
      )}

      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-800 bg-[#0D1326] p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order reference or customer email..."
            className="w-full rounded-xl border border-slate-800 bg-[#070B19] py-2 pl-9 pr-3 text-sm text-white"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
        >
          <option value="">All Categories</option>
          <option value="vpn">VPN</option>
          <option value="proxy">Proxy</option>
          <option value="uk-number">UK Numbers</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
        >
          <option value="">All Order Statuses</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="paid">Paid</option>
          <option value="processing">Processing</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0D1326]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-5 py-3.5">Reference</th>
              <th className="px-5 py-3.5">Customer</th>
              <th className="px-5 py-3.5">Product</th>
              <th className="px-5 py-3.5">Amount</th>
              <th className="px-5 py-3.5">Payment</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  Loading orders...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-5 py-4 font-mono text-xs text-white">{o.order_reference}</td>
                  <td className="px-5 py-4 text-xs text-slate-300">{o.customer_email}</td>
                  <td className="px-5 py-4 text-slate-200">{o.items?.[0]?.product_name}</td>
                  <td className="px-5 py-4 font-semibold text-white">
                    {formatNaira(o.total_kobo)}
                  </td>
                  <td className="px-5 py-4 capitalize text-slate-300">{o.payment_status}</td>
                  <td className="px-5 py-4 capitalize text-xs text-slate-200">
                    {o.status.replace(/_/g, " ")}
                  </td>
                  <td className="px-5 py-4 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(o)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-white hover:border-blue-500"
                    >
                      Inspect / Fulfil
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-[#0D1326] p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <p className="font-mono text-xs text-blue-400">{selectedOrder.order_reference}</p>
                <h2 className="text-lg font-bold text-white">{selectedOrder.customer_email}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            {selectedOrder.fulfilments?.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-[#070B19] p-4 text-xs">
                <p className="font-semibold text-slate-300">Supplier / Fulfilment Log</p>
                <pre className="mt-2 overflow-x-auto text-slate-400">
                  {JSON.stringify(selectedOrder.fulfilments, null, 2)}
                </pre>
              </div>
            )}

            {selectedOrder.payment_status === "paid" && selectedOrder.status !== "delivered" && (
              <div className="space-y-3 rounded-xl border border-slate-800 bg-[#070B19] p-4">
                <p className="text-xs font-semibold uppercase text-slate-300">
                  Manual Fulfilment (Deliver Credentials)
                </p>
                <textarea
                  rows={5}
                  value={credentialsJson}
                  onChange={(e) => setCredentialsJson(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-[#0D1326] p-3 font-mono text-xs text-white"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => manualFulfil(selectedOrder.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Deliver Manually
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => retryOrder(selectedOrder.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-300"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Retry Automated Supplier
                  </button>
                </div>
              </div>
            )}

            {selectedOrder.payment_status === "paid" && selectedOrder.status !== "refunded" && (
              <div className="space-y-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                <p className="text-xs font-semibold uppercase text-rose-300">
                  Issue Wallet Refund Credit
                </p>
                <div className="flex gap-2">
                  <input
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Reason for refund..."
                    className="flex-1 rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => refundOrder(selectedOrder.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Refund {formatNaira(selectedOrder.total_kobo)}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
