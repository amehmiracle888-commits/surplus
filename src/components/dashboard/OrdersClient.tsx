"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Eye, Loader2, X } from "lucide-react";
import { hasServiceSharedLogin, SHARED_LOGIN_BODY, SHARED_LOGIN_HEADING } from "@/lib/product-notices";
import { formatNaira } from "@/lib/utils";

interface OrderSummary {
  id: string;
  order_reference: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_kobo: number;
  created_at: string;
  items: {
    id: string;
    product_name: string;
    quantity: number;
    category_slug: string;
  }[];
}

interface OrderDetailPayload {
  order: OrderSummary & { payment_reference?: string; paid_at?: string; fulfilled_at?: string };
  items: {
    id: string;
    product_name: string;
    provider: string;
    quantity: number;
    unit_price_kobo: number;
    total_price_kobo: number;
    selected_options: Record<string, unknown>;
  }[];
  services: {
    id: string;
    service_label: string;
    status: string;
    credentials: Record<string, unknown>;
  }[];
}

export function OrdersClient({
  initialOrders,
  verifyReference,
}: {
  initialOrders: OrderSummary[];
  verifyReference?: string;
}) {
  const [orders] = useState<OrderSummary[]>(initialOrders);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetailPayload | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!verifyReference) return;
    const isPaystack = verifyReference.startsWith("PSK-");
    const endpoint = isPaystack
      ? `/api/payments/paystack/verify?reference=${encodeURIComponent(verifyReference)}`
      : `/api/payments/bachs/verify?reference=${encodeURIComponent(verifyReference)}`;
    fetch(endpoint)
      .then((r) => r.json())
      .then((d) => {
        setVerifyMessage(d.message || d.error || "Payment verified");
      })
      .catch(() => null);
  }, [verifyReference]);

  async function openDetail(orderId: string) {
    setLoadingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (res.ok) setSelectedOrder(data);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Orders</h1>
        <p className="mt-1 text-sm text-slate-400">
          Track payment confirmation, automated or manual fulfilment status, and delivered credentials.
        </p>
      </div>

      {verifyMessage && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {verifyMessage}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0D1326]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-5 py-3.5">Reference</th>
              <th className="px-5 py-3.5">Product</th>
              <th className="px-5 py-3.5">Qty</th>
              <th className="px-5 py-3.5">Amount</th>
              <th className="px-5 py-3.5">Payment</th>
              <th className="px-5 py-3.5">Fulfilment</th>
              <th className="px-5 py-3.5">Date</th>
              <th className="px-5 py-3.5 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-900/40">
                  <td className="px-5 py-4 font-mono text-xs text-white">{order.order_reference}</td>
                  <td className="px-5 py-4 text-slate-200">
                    {order.items?.[0]?.product_name || "Digital Product"}
                  </td>
                  <td className="px-5 py-4 text-slate-300">{order.items?.[0]?.quantity ?? 1}</td>
                  <td className="px-5 py-4 font-semibold text-white">
                    {formatNaira(order.total_kobo)}
                  </td>
                  <td className="px-5 py-4 capitalize text-slate-300">{order.payment_status}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs capitalize text-slate-200">
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => openDetail(order.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-blue-500"
                    >
                      {loadingId === order.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <p className="font-mono text-xs text-blue-400">{selectedOrder.order.order_reference}</p>
                <h2 className="text-lg font-bold text-white">Order Details</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-[#070B19] p-3.5">
                  <p className="text-xs text-slate-400">Payment Method</p>
                  <p className="font-medium capitalize text-white">
                    {selectedOrder.order.payment_method}
                  </p>
                </div>
                <div className="rounded-xl bg-[#070B19] p-3.5">
                  <p className="text-xs text-slate-400">Amount Paid</p>
                  <p className="font-semibold text-white">
                    {formatNaira(selectedOrder.order.total_kobo)}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase text-slate-400">Items</h3>
                <div className="mt-2 space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-800 bg-[#070B19] p-3.5">
                      <div className="flex justify-between">
                        <span className="font-medium text-white">
                          {item.product_name} × {item.quantity}
                        </span>
                        <span className="text-white">{formatNaira(item.total_price_kobo)}</span>
                      </div>
                      {Object.keys(item.selected_options || {}).length > 0 && (
                        <p className="mt-1 text-xs text-slate-400">
                          Options: {JSON.stringify(item.selected_options)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase text-slate-400">
                  Delivery Information
                </h3>
                {selectedOrder.services.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">
                    No credentials delivered yet. Status:{" "}
                    <span className="capitalize text-white">
                      {selectedOrder.order.status.replace(/_/g, " ")}
                    </span>
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {selectedOrder.services.map((srv) => {
                      const isShared = hasServiceSharedLogin({
                        label: srv.service_label,
                        credentials: srv.credentials,
                      });
                      return (
                        <div
                          key={srv.id}
                          className="rounded-xl border border-emerald-500/20 bg-[#070B19] p-4"
                        >
                          <p className="font-medium text-emerald-300">{srv.service_label}</p>
                          {isShared && (
                            <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                              <p className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-amber-300">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                {SHARED_LOGIN_HEADING} — STRICTLY 1 USER (1 DEVICE)
                              </p>
                              <p className="mt-1 font-semibold">{SHARED_LOGIN_BODY}</p>
                            </div>
                          )}
                          <pre className="mt-2 overflow-x-auto font-mono text-xs text-slate-200">
                            {JSON.stringify(srv.credentials, null, 2)}
                          </pre>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
