"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatNaira, koboToNaira } from "@/lib/utils";

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface ProductRow {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  provider: string;
  short_description: string;
  description: string;
  image_url: string | null;
  terms_and_conditions: string;
  setup_instructions: string;
  billing_cycle: string;
  duration_days: number;
  retail_price_kobo: number;
  wholesale_cost_kobo: number;
  renewal_price_kobo: number | null;
  delivery_method: "automated" | "manual";
  availability_status: "in_stock" | "low_stock" | "out_of_stock" | "discontinued";
  stock_quantity: number | null;
  default_supplier_id: string | null;
  is_active: boolean;
  is_featured: boolean;
  is_popular: boolean;
  metadata: Record<string, unknown>;
  options_schema: unknown[];
  category?: Category;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; category_slug: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [provider, setProvider] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [setupInstructions, setSetupInstructions] = useState("");
  const [terms, setTerms] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [durationDays, setDurationDays] = useState("30");
  const [retailNaira, setRetailNaira] = useState("5000");
  const [wholesaleNaira, setWholesaleNaira] = useState("3000");
  const [renewalNaira, setRenewalNaira] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"automated" | "manual">("manual");
  const [availability, setAvailability] = useState<"in_stock" | "low_stock" | "out_of_stock" | "discontinued">("in_stock");
  const [defaultSupplierId, setDefaultSupplierId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPopular, setIsPopular] = useState(false);
  const [metadataJson, setMetadataJson] = useState("{}");
  const [optionsJson, setOptionsJson] = useState("[]");

  async function loadAll() {
    setLoading(true);
    try {
      const [prodRes, supRes] = await Promise.all([
        fetch("/api/admin/products"),
        fetch("/api/admin/suppliers"),
      ]);
      const prodData = await prodRes.json();
      const supData = await supRes.json();
      setProducts(prodData.products ?? []);
      const cats = (prodData.categories ?? []) as Category[];
      setCategories(cats);
      if (!categoryId && cats.length > 0) setCategoryId(cats[0].id);
      setSuppliers(supData.suppliers ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setSlug("");
    setProvider("");
    setShortDesc("");
    setDescription("");
    setImageUrl("");
    setSetupInstructions("");
    setTerms("");
    setBillingCycle("monthly");
    setDurationDays("30");
    setRetailNaira("5000");
    setWholesaleNaira("3000");
    setRenewalNaira("");
    setDeliveryMethod("manual");
    setAvailability("in_stock");
    setDefaultSupplierId("");
    setIsActive(true);
    setIsFeatured(false);
    setIsPopular(false);
    setMetadataJson("{}");
    setOptionsJson("[]");
  }

  function startEdit(p: ProductRow) {
    setEditingId(p.id);
    setCategoryId(p.category_id);
    setName(p.name);
    setSlug(p.slug);
    setProvider(p.provider);
    setShortDesc(p.short_description);
    setDescription(p.description);
    setImageUrl(p.image_url || "");
    setSetupInstructions(p.setup_instructions);
    setTerms(p.terms_and_conditions);
    setBillingCycle(p.billing_cycle);
    setDurationDays(String(p.duration_days));
    setRetailNaira(String(koboToNaira(p.retail_price_kobo)));
    setWholesaleNaira(String(koboToNaira(p.wholesale_cost_kobo)));
    setRenewalNaira(p.renewal_price_kobo != null ? String(koboToNaira(p.renewal_price_kobo)) : "");
    setDeliveryMethod(p.delivery_method);
    setAvailability(p.availability_status);
    setDefaultSupplierId(p.default_supplier_id || "");
    setIsActive(p.is_active);
    setIsFeatured(p.is_featured);
    setIsPopular(p.is_popular);
    setMetadataJson(JSON.stringify(p.metadata ?? {}, null, 2));
    setOptionsJson(JSON.stringify(p.options_schema ?? [], null, 2));
  }

  async function handleImageUpload(file: File) {
    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `products/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from("product-images").upload(path, file);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setImageUrl(data.publicUrl);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let parsedMeta: Record<string, unknown> = {};
    let parsedOpts: unknown[] = [];
    try {
      parsedMeta = JSON.parse(metadataJson || "{}");
      parsedOpts = JSON.parse(optionsJson || "[]");
    } catch {
      setError("Metadata or Options Schema contains invalid JSON");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: editingId ?? undefined,
        category_id: categoryId,
        name,
        slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        provider,
        short_description: shortDesc,
        description,
        image_url: imageUrl || null,
        setup_instructions: setupInstructions,
        terms_and_conditions: terms,
        billing_cycle: billingCycle,
        duration_days: Number(durationDays) || 30,
        retail_price_naira: Number(retailNaira) || 0,
        wholesale_cost_naira: Number(wholesaleNaira) || 0,
        renewal_price_naira: renewalNaira ? Number(renewalNaira) : null,
        delivery_method: deliveryMethod,
        availability_status: availability,
        default_supplier_id: defaultSupplierId || null,
        is_active: isActive,
        is_featured: isFeatured,
        is_popular: isPopular,
        metadata: parsedMeta,
        options_schema: parsedOpts,
      };

      const res = await fetch("/api/admin/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save product");
        return;
      }
      resetForm();
      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadAll();
  }

  const marginNaira = (Number(retailNaira) || 0) - (Number(wholesaleNaira) || 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Product Management</h1>
          <p className="mt-1 text-sm text-slate-400">
            Configure VPN, Proxy, and UK Virtual Number plans, wholesale margins, and homepage
            visibility.
          </p>
        </div>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300"
          >
            Cancel Edit
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
        <h2 className="text-base font-semibold text-white">
          {editingId ? "Edit Product" : "Create New Product"}
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-xs text-slate-300">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300">Product Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., NordVPN 1-Month Plan"
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300">URL Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto-generated-if-empty"
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300">Provider / Brand</label>
            <input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g., NordVPN / IPRocket / Twilio UK"
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300">Billing Cycle</label>
            <select
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly (3 Months)</option>
              <option value="biannual">Six Months</option>
              <option value="annual">Annual</option>
              <option value="weekly">Weekly</option>
              <option value="once">One-time / Temporary</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300">Duration (Days)</label>
            <input
              type="number"
              min={1}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300">Retail Price (₦)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={retailNaira}
              onChange={(e) => setRetailNaira(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300">
              Wholesale Cost (₦) — Margin: ₦{marginNaira.toLocaleString()}
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={wholesaleNaira}
              onChange={(e) => setWholesaleNaira(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300">Renewal Price (₦, Optional)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={renewalNaira}
              onChange={(e) => setRenewalNaira(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300">Delivery Method</label>
            <select
              value={deliveryMethod}
              onChange={(e) => setDeliveryMethod(e.target.value as "automated" | "manual")}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            >
              <option value="manual">Manual Fulfilment</option>
              <option value="automated">Automated Supplier API</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300">Availability</label>
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value as typeof availability)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            >
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="discontinued">Discontinued</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300">Default Supplier</label>
            <select
              value={defaultSupplierId}
              onChange={(e) => setDefaultSupplierId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            >
              <option value="">None (Manual Queue)</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.category_slug})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-300">Short Description</label>
            <input
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300">Product Image URL or Upload</label>
            <div className="mt-1 flex gap-2">
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
              />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-blue-500">
                <Upload className="h-3.5 w-3.5" />
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-300">Full Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300">Setup Instructions</label>
            <textarea
              rows={3}
              value={setupInstructions}
              onChange={(e) => setSetupInstructions(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-300">
              Category Capabilities Metadata (JSON)
            </label>
            <textarea
              rows={3}
              value={metadataJson}
              onChange={(e) => setMetadataJson(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 font-mono text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300">
              Checkout Options Schema (JSON Array)
            </label>
            <textarea
              rows={3}
              value={optionsJson}
              onChange={(e) => setOptionsJson(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 font-mono text-xs text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-300">Terms &amp; Conditions</label>
          <textarea
            rows={2}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2 text-sm text-white"
          />
        </div>

        <div className="flex flex-wrap gap-6 text-xs text-slate-300">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active / Visible
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
            Featured on Homepage
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isPopular} onChange={(e) => setIsPopular(e.target.checked)} />
            Popular Product
          </label>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {editingId ? "Update Product" : "Create Product"}
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0D1326]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-5 py-3.5">Product</th>
              <th className="px-5 py-3.5">Category</th>
              <th className="px-5 py-3.5">Retail</th>
              <th className="px-5 py-3.5">Wholesale</th>
              <th className="px-5 py-3.5">Margin</th>
              <th className="px-5 py-3.5">Delivery</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                  Loading products...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                  No products created yet. Use the form above to publish real catalogue items.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-white">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.provider}</p>
                  </td>
                  <td className="px-5 py-3.5 text-slate-300">{p.category?.name}</td>
                  <td className="px-5 py-3.5 font-semibold text-white">
                    {formatNaira(p.retail_price_kobo)}
                  </td>
                  <td className="px-5 py-3.5 text-slate-300">
                    {formatNaira(p.wholesale_cost_kobo)}
                  </td>
                  <td className="px-5 py-3.5 text-emerald-400">
                    {formatNaira(p.retail_price_kobo - p.wholesale_cost_kobo)}
                  </td>
                  <td className="px-5 py-3.5 capitalize text-slate-300">{p.delivery_method}</td>
                  <td className="px-5 py-3.5 text-xs">
                    {p.is_active ? (
                      <span className="text-emerald-400">Active</span>
                    ) : (
                      <span className="text-slate-500">Disabled</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:border-blue-500"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="rounded-lg border border-slate-700 p-1.5 text-rose-400 hover:border-rose-500"
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
