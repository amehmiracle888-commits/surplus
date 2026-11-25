import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock, Network, Phone, Shield, Zap } from "lucide-react";
import { formatDurationLabel, formatNaira } from "@/lib/utils";
import type { PublicProduct } from "@/types/database";

export function ProductCard({ product }: { product: PublicProduct }) {
  const categorySlug = product.category?.slug || "vpn";
  const isOut = product.availability_status === "out_of_stock" || product.availability_status === "discontinued";
  const meta = product.metadata || {};

  const CategoryIcon = categorySlug === "proxy" ? Network : categorySlug === "uk-number" ? Phone : Shield;

  return (
    <div className="group flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0D1326] p-6 transition hover:border-blue-500/40 hover:bg-[#101830]">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="h-11 w-11 rounded-xl border border-slate-800 object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-blue-400 ring-1 ring-blue-500/25">
                <CategoryIcon className="h-5 w-5" />
              </div>
            )}
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-blue-400">
                {product.provider || product.category?.name || categorySlug}
              </span>
              <h3 className="text-base font-semibold text-white group-hover:text-blue-300 transition-colors">
                {product.name}
              </h3>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              isOut
                ? "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30"
                : product.delivery_method === "automated"
                  ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30"
                  : "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30"
            }`}
          >
            {isOut ? "Out of Stock" : product.delivery_method === "automated" ? "Instant API" : "Manual Delivery"}
          </span>
        </div>

        <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-slate-400">
          {product.short_description || product.description}
        </p>

        {/* Category-specific transparent capabilities */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-900/90 px-2.5 py-1 ring-1 ring-slate-800">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            {formatDurationLabel(product.duration_days, product.billing_cycle)}
          </span>

          {categorySlug === "vpn" && meta.device_limit && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-900/90 px-2.5 py-1 ring-1 ring-slate-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
              {meta.device_limit} Devices
            </span>
          )}

          {categorySlug === "proxy" && meta.proxy_type && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-900/90 px-2.5 py-1 ring-1 ring-slate-800 capitalize">
              <Zap className="h-3.5 w-3.5 text-violet-400" />
              {String(meta.proxy_type).replace(/_/g, " ")}
            </span>
          )}

          {categorySlug === "proxy" && meta.bandwidth_gb && (
            <span className="rounded-md bg-slate-900/90 px-2.5 py-1 ring-1 ring-slate-800">
              {meta.bandwidth_gb} GB
            </span>
          )}

          {categorySlug === "uk-number" && (
            <>
              <span className="rounded-md bg-slate-900/90 px-2.5 py-1 ring-1 ring-slate-800">
                +44 UK • {meta.number_type === "temporary" ? "Temporary" : "Dedicated"}
              </span>
              {meta.sms_capable && (
                <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-emerald-300 ring-1 ring-emerald-500/20">
                  SMS
                </span>
              )}
              {meta.voice_capable && (
                <span className="rounded-md bg-blue-500/10 px-2.5 py-1 text-blue-300 ring-1 ring-blue-500/20">
                  Voice
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-slate-800/80 pt-4">
        <div>
          <p className="text-xs text-slate-400">Starting at</p>
          <p className="text-xl font-bold tracking-tight text-white">
            {formatNaira(product.retail_price_kobo)}
          </p>
        </div>

        <Link
          href={`/products/${product.slug}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
        >
          View Plan
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
