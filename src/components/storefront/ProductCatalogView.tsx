"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { PublicProduct } from "@/types/database";

interface ProductCatalogViewProps {
  products: PublicProduct[];
  categoryFilter?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
}

export function ProductCatalogView({
  products,
  categoryFilter,
  emptyTitle = "No active products published in this category yet",
  emptySubtitle = "Products configured and enabled in the Admin Dashboard appear here automatically.",
}: ProductCatalogViewProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(categoryFilter || "all");
  const [proxyTypeFilter, setProxyTypeFilter] = useState("all");
  const [ukCapabilityFilter, setUkCapabilityFilter] = useState("all");

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const catSlug = p.category?.slug || "";
      if (selectedCategory !== "all" && catSlug !== selectedCategory) return false;

      if (proxyTypeFilter !== "all" && catSlug === "proxy") {
        if (p.metadata?.proxy_type !== proxyTypeFilter) return false;
      }

      if (ukCapabilityFilter !== "all" && catSlug === "uk-number") {
        if (ukCapabilityFilter === "sms" && !p.metadata?.sms_capable) return false;
        if (ukCapabilityFilter === "voice" && !p.metadata?.voice_capable) return false;
        if (ukCapabilityFilter === "both" && (!p.metadata?.sms_capable || !p.metadata?.voice_capable))
          return false;
        if (ukCapabilityFilter === "dedicated" && p.metadata?.number_type !== "dedicated") return false;
        if (ukCapabilityFilter === "temporary" && p.metadata?.number_type !== "temporary") return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${p.name} ${p.provider} ${p.short_description} ${p.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [products, selectedCategory, proxyTypeFilter, ukCapabilityFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-[#0D1326] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product, provider, country or plan..."
            className="w-full rounded-xl border border-slate-800 bg-[#070B19] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!categoryFilter && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="vpn">VPN Subscriptions</option>
              <option value="proxy">Proxy Services</option>
              <option value="uk-number">UK Virtual Numbers</option>
            </select>
          )}

          {(categoryFilter === "proxy" || selectedCategory === "proxy") && (
            <select
              value={proxyTypeFilter}
              onChange={(e) => setProxyTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Proxy Types</option>
              <option value="residential">Residential</option>
              <option value="static_residential">Static Residential</option>
              <option value="rotating_residential">Rotating Residential</option>
              <option value="mobile_4g_5g">Mobile 4G/5G</option>
              <option value="isp">ISP Proxies</option>
              <option value="datacenter">Datacenter</option>
            </select>
          )}

          {(categoryFilter === "uk-number" || selectedCategory === "uk-number") && (
            <select
              value={ukCapabilityFilter}
              onChange={(e) => setUkCapabilityFilter(e.target.value)}
              className="rounded-xl border border-slate-800 bg-[#070B19] px-3 py-2.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All UK Capabilities</option>
              <option value="sms">SMS Capable</option>
              <option value="voice">Voice Capable</option>
              <option value="both">SMS + Voice</option>
              <option value="dedicated">Dedicated (+44)</option>
              <option value="temporary">Temporary (+44)</option>
            </select>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0D1326]/60 px-6 py-16 text-center">
          <SlidersHorizontal className="mx-auto h-8 w-8 text-slate-500" />
          <h3 className="mt-4 text-base font-semibold text-white">{emptyTitle}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">{emptySubtitle}</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
