import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Headphones,
  KeyRound,
  Lock,
  Network,
  Phone,
  Shield,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import { PublicShell } from "@/components/layout/PublicShell";
import { ProductCard } from "@/components/storefront/ProductCard";
import { getPublicProducts } from "@/lib/catalog";
import { getPublicSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [config, featuredProducts, popularProducts] = await Promise.all([
    getPublicSiteConfig(),
    getPublicProducts({ featuredOnly: true }),
    getPublicProducts({ popularOnly: true }),
  ]);

  const displayedPopular = popularProducts.slice(0, 6);
  const displayedFeatured = featuredProducts.slice(0, 3);

  return (
    <PublicShell>
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-800/80">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.16),_transparent_55%),radial-gradient(ellipse_at_top_right,_rgba(139,92,246,0.12),_transparent_45%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Nigerian Naira (₦) Payments • Bachs.io Verified • Automated API Delivery
            </div>

            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              {config.homepage.heroHeadline}
            </h1>

            <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">
              {config.homepage.heroSubtext}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
              <Link
                href="/shop"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-110 sm:w-auto"
              >
                {config.homepage.primaryCta}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-700 bg-[#0D1326] px-6 py-3.5 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-[#121A33] sm:w-auto"
              >
                {config.homepage.secondaryCta}
              </Link>
            </div>
          </div>

          {/* Three Core Service Categories */}
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            <Link
              href="/vpn"
              className="group rounded-2xl border border-slate-800 bg-[#0D1326]/90 p-7 transition hover:border-blue-500/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
                <Shield className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-white group-hover:text-blue-300">
                VPN Subscriptions
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Weekly and monthly plans across leading VPN providers with strict 1-user (1-device)
                limits, bold shared-login notices where applicable, and setup guides.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-blue-400">
                Browse VPN plans <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>

            <Link
              href="/proxies"
              className="group rounded-2xl border border-slate-800 bg-[#0D1326]/90 p-7 transition hover:border-violet-500/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20">
                <Network className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-white group-hover:text-violet-300">
                Proxy Services
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Residential, static residential, rotating, mobile 4G/5G, ISP, and datacenter proxies
                with verified protocol and bandwidth specs.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-violet-400">
                Explore proxies <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>

            <Link
              href="/uk-numbers"
              className="group rounded-2xl border border-slate-800 bg-[#0D1326]/90 p-7 transition hover:border-blue-500/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                <Phone className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-white group-hover:text-emerald-300">
                UK Virtual Numbers
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Exclusively +44 UK numbers with clearly marked SMS, Voice, temporary, or dedicated
                renewable capabilities.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                View UK numbers <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Packages */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Featured Packages
            </p>
            <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
              Curated Infrastructure Plans
            </h2>
          </div>
          <Link href="/shop" className="text-sm font-medium text-blue-400 hover:text-blue-300">
            View full catalogue &rarr;
          </Link>
        </div>

        {displayedFeatured.length > 0 ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {displayedFeatured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-800 bg-[#0D1326]/50 p-8 text-center">
            <p className="text-sm text-slate-300">
              No featured packages are currently published. Administrators can configure and feature
              live products from the Admin Dashboard.
            </p>
          </div>
        )}
      </section>

      {/* Popular Products */}
      <section className="border-y border-slate-800/80 bg-[#090F22]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">
                Catalogue Highlights
              </p>
              <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Popular Products</h2>
            </div>
            <Link href="/shop" className="text-sm font-medium text-violet-400 hover:text-violet-300">
              Filter all products &rarr;
            </Link>
          </div>

          {displayedPopular.length > 0 ? (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {displayedPopular.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-800 bg-[#0D1326]/50 p-8 text-center">
              <p className="text-sm text-slate-400">
                Popular products marked in the catalogue will appear here once published.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* How the Platform Works & Instant Delivery Explanation */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Transparent Workflow
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              How the Platform Works
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Every order passes through server-side price validation, Paystack or ledger wallet
              verification, and structured supplier provisioning.
            </p>

            <div className="mt-8 space-y-5">
              {[
                {
                  step: "01",
                  title: "Select a Verified Plan",
                  desc: "Choose a VPN subscription, proxy package, or UK (+44) virtual number with real supplier specifications.",
                },
                {
                  step: "02",
                  title: "Pay in Nigerian Naira (₦)",
                  desc: "Checkout with Bachs.io (card, NGN bank transfer, mobile money, crypto) or debit your pre-funded Naira wallet.",
                },
                {
                  step: "03",
                  title: "Automated or Managed Fulfilment",
                  desc: "Confirmed payments trigger backend supplier API provisioning or enter admin manual delivery when specified.",
                },
                {
                  step: "04",
                  title: "Manage & Renew in Your Dashboard",
                  desc: "Copy encrypted credentials, inspect proxy usage or SMS inbox where supported, and renew before expiry.",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 font-mono text-xs font-bold text-blue-300 ring-1 ring-blue-500/30">
                    {item.step}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-8">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-blue-300 ring-1 ring-blue-500/30">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-xl font-semibold text-white">
              {config.homepage.instantDeliveryTitle}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {config.homepage.instantDeliveryBody}
            </p>
            <div className="mt-6 space-y-3 border-t border-slate-800 pt-6 text-sm text-slate-300">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Signed Bachs.io webhook &amp; backend verification before delivery
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Idempotent order execution prevents duplicate charges or double allocation
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Automatic wallet refund credit on confirmed supplier fulfilment failure
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us + Payment Methods */}
      <section className="border-y border-slate-800/80 bg-[#090F22]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
              <Lock className="h-6 w-6 text-blue-400" />
              <h3 className="mt-4 text-base font-semibold text-white">Encrypted Credential Vault</h3>
              <p className="mt-2 text-sm text-slate-400">
                Supplier secrets and delivered service credentials are encrypted server-side and scoped
                strictly to the authenticated purchaser.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
              <CreditCard className="h-6 w-6 text-violet-400" />
              <h3 className="mt-4 text-base font-semibold text-white">Local Naira Payments</h3>
              <p className="mt-2 text-sm text-slate-400">
                Pay seamlessly in ₦ without a dollar card via Bachs.io cards, NGN bank transfers, or
                your auditable customer wallet.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
              <Headphones className="h-6 w-6 text-emerald-400" />
              <h3 className="mt-4 text-base font-semibold text-white">Dedicated Support System</h3>
              <p className="mt-2 text-sm text-slate-400">
                Open order-linked support tickets with screenshot attachments in your dashboard or reach
                our support team directly.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0D1326] p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Supported Payment Methods (Nigerian Naira ₦)
                </h3>
                <p className="text-xs text-slate-400">
                  Bachs.io Cards • NGN Bank Transfer • Crypto • Instant Customer Wallet
                </p>
              </div>
            </div>
            <Link
              href="/contact"
              className="text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              Need payment assistance? Contact Support &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* FAQs */}
      {config.faqs.length > 0 && (
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">FAQs</p>
            <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="mt-8 space-y-4">
            {config.faqs.slice(0, 6).map((faq) => (
              <div key={faq.id} className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
                <h3 className="text-base font-semibold text-white">{faq.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{faq.answer}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/faq" className="text-sm font-medium text-blue-400 hover:text-blue-300">
              View all FAQs &rarr;
            </Link>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-blue-500/25 bg-gradient-to-br from-[#0E1733] via-[#111938] to-[#161334] px-6 py-12 text-center sm:px-12">
          <KeyRound className="mx-auto h-8 w-8 text-blue-400" />
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
            Ready to Provision Your Digital Services?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300">
            Create an account to fund your Naira wallet, track active subscriptions, and receive
            automated delivery straight to your dashboard.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/shop"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Explore Products
            </Link>
            <Link
              href="/register"
              className="rounded-xl border border-slate-700 bg-[#070B19]/70 px-6 py-3 text-sm font-semibold text-white transition hover:border-slate-500"
            >
              Create Account
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
