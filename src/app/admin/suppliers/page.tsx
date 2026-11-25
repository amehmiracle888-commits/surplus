"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2, Plus, Trash2 } from "lucide-react";

interface SupplierRow {
  id: string;
  name: string;
  adapter_key: string;
  category_slug: string;
  api_base_url: string;
  auth_method: string;
  has_api_key: boolean;
  api_docs_url: string;
  is_active: boolean;
  priority: number;
  balance_amount: number | null;
  balance_currency: string | null;
  last_connected_at: string | null;
  connection_status: string;
  last_error: string | null;
  config: Record<string, unknown>;
}

interface MappingRow {
  id: string;
  external_product_id: string;
  external_plan_code: string;
  wholesale_cost_kobo: number;
  priority: number;
  is_default: boolean;
  product?: { id: string; name: string };
  supplier?: { id: string; name: string };
}

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [adapters, setAdapters] = useState<{ key: string; label: string }[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [categorySlug, setCategorySlug] = useState("proxy");
  const [adapterKey, setAdapterKey] = useState("custom_rest");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [authMethod, setAuthMethod] = useState("bearer");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [apiDocsUrl, setApiDocsUrl] = useState("");
  const [priority, setPriority] = useState("10");
  const [configJson, setConfigJson] = useState(
    JSON.stringify(
      {
        testEndpoint: "",
        balanceEndpoint: "",
        provisionEndpoint: "",
        renewEndpoint: "",
        usageEndpoint: "",
        messagesEndpoint: "",
      },
      null,
      2
    )
  );

  // Mapping form
  const [mapSupplierId, setMapSupplierId] = useState("");
  const [mapProductId, setMapProductId] = useState("");
  const [externalProductId, setExternalProductId] = useState("");
  const [mapPriority, setMapPriority] = useState("10");
  const [mapDefault, setMapDefault] = useState(true);

  async function loadAll() {
    const [supRes, prodRes] = await Promise.all([
      fetch("/api/admin/suppliers"),
      fetch("/api/admin/products"),
    ]);
    const supData = await supRes.json();
    const prodData = await prodRes.json();
    setSuppliers(supData.suppliers ?? []);
    setMappings(supData.mappings ?? []);
    setAdapters(supData.adapters ?? []);
    setProducts(prodData.products ?? []);
    if (!mapSupplierId && supData.suppliers?.[0]?.id) setMapSupplierId(supData.suppliers[0].id);
    if (!mapProductId && prodData.products?.[0]?.id) setMapProductId(prodData.products[0].id);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateSupplier(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const config = JSON.parse(configJson || "{}");
      await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category_slug: categorySlug,
          adapter_key: adapterKey,
          api_base_url: apiBaseUrl,
          auth_method: authMethod,
          api_key: apiKey,
          api_secret: apiSecret,
          api_docs_url: apiDocsUrl,
          priority: Number(priority) || 10,
          is_active: true,
          config,
        }),
      });
      setName("");
      setApiBaseUrl("");
      setApiKey("");
      setApiSecret("");
      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  async function handleMapProduct(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "map_product",
        supplier_id: mapSupplierId,
        product_id: mapProductId,
        external_product_id: externalProductId,
        priority: Number(mapPriority) || 10,
        is_default: mapDefault,
      }),
    });
    setExternalProductId("");
    await loadAll();
  }

  async function testConnection(id: string) {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/suppliers/${id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult(`${data.ok ? "SUCCESS" : "FAILED"}: ${data.message}`);
      await loadAll();
    } finally {
      setTestingId(null);
    }
  }

  async function deleteSupplier(id: string) {
    if (!confirm("Delete supplier?")) return;
    await fetch(`/api/admin/suppliers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadAll();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Supplier API Management</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure external supplier adapters with encrypted server-side credentials, priority
          fallbacks, and live connection testing. API keys are never returned to the browser.
        </p>
      </div>

      {testResult && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {testResult}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleCreateSupplier}
          className="space-y-4 rounded-2xl border border-slate-800 bg-[#0D1326] p-6 lg:col-span-7"
        >
          <h2 className="text-base font-semibold text-white">Add Supplier Integration</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-slate-300">Supplier Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Official Supplier API"
                className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300">Product Category</label>
              <select
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
              >
                <option value="vpn">VPN Subscriptions</option>
                <option value="proxy">Proxy Services</option>
                <option value="uk-number">UK Virtual Numbers</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300">Adapter</label>
              <select
                value={adapterKey}
                onChange={(e) => setAdapterKey(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
              >
                {adapters.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300">Authentication Method</label>
              <select
                value={authMethod}
                onChange={(e) => setAuthMethod(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
              >
                <option value="bearer">Bearer Token</option>
                <option value="api_key_header">API Key Header</option>
                <option value="basic">Basic Auth</option>
                <option value="custom_header">Custom Header</option>
                <option value="none">None / Manual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300">API Base URL</label>
              <input
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="https://api.supplier.com/v1"
                className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300">Priority (Lower = First)</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300">API Key (Encrypted at Rest)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300">API Secret (Optional)</label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300">API Documentation URL</label>
            <input
              value={apiDocsUrl}
              onChange={(e) => setApiDocsUrl(e.target.value)}
              placeholder="https://docs.supplier.com"
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300">
              Documented Endpoint Mapping (JSON)
            </label>
            <textarea
              rows={5}
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 font-mono text-xs text-white"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save Supplier
          </button>
        </form>

        <form
          onSubmit={handleMapProduct}
          className="space-y-4 rounded-2xl border border-slate-800 bg-[#0D1326] p-6 lg:col-span-5"
        >
          <h2 className="text-base font-semibold text-white">Map Product Compatibility</h2>
          <p className="text-xs text-slate-400">
            Automated fallback only switches to suppliers explicitly mapped as compatible with the
            product.
          </p>
          <div>
            <label className="block text-xs text-slate-300">Product</label>
            <select
              value={mapProductId}
              onChange={(e) => setMapProductId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300">Supplier</label>
            <select
              value={mapSupplierId}
              onChange={(e) => setMapSupplierId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.category_slug})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300">Supplier External Product ID</label>
            <input
              required
              value={externalProductId}
              onChange={(e) => setExternalProductId(e.target.value)}
              placeholder="e.g., plan_uk_res_5gb"
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300">Fallback Priority</label>
            <input
              type="number"
              value={mapPriority}
              onChange={(e) => setMapPriority(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={mapDefault} onChange={(e) => setMapDefault(e.target.checked)} />
            Primary / Default Supplier for Product
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white"
          >
            Save Compatibility Mapping
          </button>

          <div className="border-t border-slate-800 pt-4 space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-400">Active Mappings</p>
            {mappings.map((m) => (
              <div key={m.id} className="rounded-lg bg-[#070B19] p-2.5 text-xs text-slate-300">
                {m.product?.name} &rarr; {m.supplier?.name} (<code>{m.external_product_id}</code>)
              </div>
            ))}
          </div>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0D1326]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-5 py-3.5">Supplier</th>
              <th className="px-5 py-3.5">Category</th>
              <th className="px-5 py-3.5">Adapter</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5">Balance</th>
              <th className="px-5 py-3.5">Last Tested</th>
              <th className="px-5 py-3.5 text-right">Tools</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  No suppliers configured yet.
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-white">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.api_base_url || "Manual"}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-300">{s.category_slug}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-300">{s.adapter_key}</td>
                  <td className="px-5 py-4 text-xs capitalize">
                    <span
                      className={
                        s.connection_status === "connected"
                          ? "text-emerald-400"
                          : s.connection_status === "failed"
                            ? "text-rose-400"
                            : "text-slate-400"
                      }
                    >
                      {s.connection_status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-300">
                    {s.balance_amount !== null ? `${s.balance_amount} ${s.balance_currency || ""}` : "—"}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {s.last_connected_at ? new Date(s.last_connected_at).toLocaleString() : "Never"}
                  </td>
                  <td className="px-5 py-4 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => testConnection(s.id)}
                      disabled={testingId === s.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-300"
                    >
                      {testingId === s.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Activity className="h-3.5 w-3.5" />
                      )}
                      Test Connection
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSupplier(s.id)}
                      className="rounded-lg border border-slate-700 p-1.5 text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
