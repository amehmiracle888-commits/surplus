import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Info, Shield, ShieldAlert, Zap } from "lucide-react";
import { PublicShell } from "@/components/layout/PublicShell";
import { CheckoutPanel } from "@/components/storefront/CheckoutPanel";
import { getPublicProductBySlug } from "@/lib/catalog";
import { getAuthenticatedUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hasSharedLogin,
  INSTANT_DELIVERY_TAG,
  RESEARCH_DISCLAIMER_SHORT,
  RESEARCH_DISCLAIMER_TITLE,
  SHARED_LOGIN_BODY,
  SHARED_LOGIN_HEADING,
  STRICT_USER_LIMIT_LONG,
} from "@/lib/product-notices";
import { formatDurationLabel, formatNaira } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);
  if (!product) notFound();

  const user = await getAuthenticatedUser().catch(() => null);
  let walletBalanceKobo: number | null = null;
  if (user) {
    const admin = createAdminClient();
    const { data: wallet } = await admin
      .from("wallets")
      .select("balance_kobo")
      .eq("user_id", user.id)
      .maybeSingle();
    walletBalanceKobo = wallet ? Number(wallet.balance_kobo) : 0;
  }

  const categorySlug = product.category?.slug || "vpn";
  const meta = product.metadata || {};
  const sharedLogin = hasSharedLogin(product);

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href={categorySlug === "proxy" ? "/proxies" : categorySlug === "uk-number" ? "/uk-numbers" : "/vpn"}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {product.category?.name || "Catalogue"}
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-7">
            <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-7">
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-medium">
                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-blue-300 ring-1 ring-blue-500/25">
                  {product.category?.name}
                </span>
                {product.provider && (
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                    Provider: {product.provider}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300 ring-1 ring-emerald-500/30">
                  <Zap className="h-3 w-3 shrink-0" />
                  {INSTANT_DELIVERY_TAG}
                </span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                  Duration: {formatDurationLabel(product.duration_days, product.billing_cycle)}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-4">
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-14 w-14 shrink-0 rounded-xl border border-slate-800 bg-[#070B19] object-contain p-1.5"
                  />
                )}
                <h1 className="text-3xl font-bold text-white">{product.name}</h1>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {product.description || product.short_description}
              </p>

              {/* Category-Specific Specifications */}
              <div className="mt-6 grid gap-3 border-t border-slate-800 pt-6 sm:grid-cols-2">
                <div className="rounded-xl bg-[#070B19] p-4 ring-1 ring-slate-800">
                  <p className="text-xs text-slate-400">User &amp; Device Limit</p>
                  <p className="mt-1 text-sm font-bold text-white">{STRICT_USER_LIMIT_LONG}</p>
                </div>

                {categorySlug === "vpn" && (
                  <div className="rounded-xl bg-[#070B19] p-4 ring-1 ring-slate-800">
                    <p className="text-xs text-slate-400">Server Locations</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {Array.isArray(meta.server_locations) && meta.server_locations.length > 0
                        ? meta.server_locations.join(", ")
                        : "Global provider network"}
                    </p>
                  </div>
                )}

                {categorySlug === "proxy" && (
                  <>
                    <div className="rounded-xl bg-[#070B19] p-4 ring-1 ring-slate-800">
                      <p className="text-xs text-slate-400">Proxy Type &amp; Rotation</p>
                      <p className="mt-1 text-sm font-semibold capitalize text-white">
                        {String(meta.proxy_type || "standard").replace(/_/g, " ")}
                        {meta.rotation_type ? ` (${meta.rotation_type})` : ""}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#070B19] p-4 ring-1 ring-slate-800">
                      <p className="text-xs text-slate-400">Protocols &amp; Auth</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {Array.isArray(meta.protocols) ? meta.protocols.join(" / ") : "HTTP / HTTPS"}{" "}
                        {Array.isArray(meta.auth_methods) ? `• ${meta.auth_methods.join(", ")}` : ""}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#070B19] p-4 ring-1 ring-slate-800">
                      <p className="text-xs text-slate-400">Bandwidth / IPs</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {meta.bandwidth_gb ? `${meta.bandwidth_gb} GB` : "Unmetered / Plan-based"}
                        {meta.ip_count ? ` • ${meta.ip_count} IPs` : ""}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#070B19] p-4 ring-1 ring-slate-800">
                      <p className="text-xs text-slate-400">Locations</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {Array.isArray(meta.countries) && meta.countries.length > 0
                          ? meta.countries.join(", ")
                          : "Selectable at checkout"}
                      </p>
                    </div>
                  </>
                )}

                {categorySlug === "uk-number" && (
                  <>
                    <div className="rounded-xl bg-[#070B19] p-4 ring-1 ring-slate-800">
                      <p className="text-xs text-slate-400">Number Format &amp; Type</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        +44 UK • {meta.number_type === "temporary" ? "Temporary Allocation" : "Dedicated Renewable"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#070B19] p-4 ring-1 ring-slate-800">
                      <p className="text-xs text-slate-400">Supported Capabilities</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {[
                          meta.sms_capable ? "Inbound SMS" : null,
                          meta.voice_capable ? "Voice Calls" : null,
                        ]
                          .filter(Boolean)
                          .join(" + ") || "Specified on allocation"}
                      </p>
                    </div>
                    {product.renewal_price_kobo && (
                      <div className="rounded-xl bg-[#070B19] p-4 ring-1 ring-slate-800 sm:col-span-2">
                        <p className="text-xs text-slate-400">Renewal Price</p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {formatNaira(product.renewal_price_kobo)} per{" "}
                          {formatDurationLabel(product.duration_days, product.billing_cycle)}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {sharedLogin && (
                <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold tracking-wide text-amber-300">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {SHARED_LOGIN_HEADING} — READ CAREFULLY
                  </p>
                  <p className="mt-1.5 text-sm font-semibold leading-relaxed text-amber-100">
                    {SHARED_LOGIN_BODY}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <ShieldAlert className="h-4 w-4 text-blue-400" />
                {RESEARCH_DISCLAIMER_TITLE}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
                {RESEARCH_DISCLAIMER_SHORT}{" "}
                <Link href="/terms" className="font-medium text-blue-400 hover:underline">
                  Read full acceptable-use terms
                </Link>
                .
              </p>
            </div>

            {product.setup_instructions && (
              <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
                <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                  <Info className="h-4 w-4 text-blue-400" />
                  Setup Instructions
                </h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                  {product.setup_instructions}
                </p>
              </div>
            )}

            {product.terms_and_conditions && (
              <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
                <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                  <FileText className="h-4 w-4 text-violet-400" />
                  Product Terms &amp; Conditions
                </h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-400">
                  {product.terms_and_conditions}
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <div className="sticky top-24 space-y-4">
              <CheckoutPanel
                product={product}
                isAuthenticated={Boolean(user)}
                walletBalanceKobo={walletBalanceKobo}
              />
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-[#0D1326]/70 px-4 py-3 text-xs text-slate-400">
                <Shield className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  Protected by backend Bachs.io verification &amp; automatic wallet credit on
                  confirmed fulfilment failure.
                </span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-[#0D1326]/70 px-4 py-3 text-xs text-slate-400">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-400" />
                <span>Credentials are accessible exclusively in your authenticated dashboard.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
