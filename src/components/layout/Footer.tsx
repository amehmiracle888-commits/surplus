import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { RESEARCH_DISCLAIMER_SHORT, RESEARCH_DISCLAIMER_TITLE } from "@/lib/product-notices";
import type { SiteConfig } from "@/types/database";

export function Footer({ config }: { config: SiteConfig }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800/80 bg-[#050814]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center">
              <BrandLogo
                brandName={config.branding.brandName}
                logoUrl={config.branding.logoUrl}
                size="sm"
              />
            </Link>
            <p className="text-sm leading-relaxed text-slate-400">
              {config.branding.tagline}. Transparent pricing in Nigerian Naira (₦) with Bachs.io
              verification and automated provisioning.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Services</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
              <li>
                <Link href="/vpn" className="hover:text-white">
                  VPN Subscriptions
                </Link>
              </li>
              <li>
                <Link href="/proxies" className="hover:text-white">
                  Proxy Services
                </Link>
              </li>
              <li>
                <Link href="/uk-numbers" className="hover:text-white">
                  UK Virtual Numbers
                </Link>
              </li>
              <li>
                <Link href="/shop" className="hover:text-white">
                  All Products
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Resources</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
              <li>
                <Link href="/how-it-works" className="hover:text-white">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/guides" className="hover:text-white">
                  Setup Guides
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-white">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white">
                  Contact &amp; Support
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Legal &amp; Contact</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
              <li>
                <Link href="/terms" className="hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-white">
                  Refund Policy
                </Link>
              </li>
              {config.contact.supportEmail && (
                <li className="pt-1">
                  <a
                    href={`mailto:${config.contact.supportEmail}`}
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
                  >
                    <Mail className="h-4 w-4" />
                    {config.contact.supportEmail}
                  </a>
                </li>
              )}
              {config.contact.whatsappUrl && (
                <li>
                  <a
                    href={config.contact.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp Support
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-slate-800/80 bg-[#0D1326]/70 px-4 py-3 text-xs leading-relaxed text-slate-400">
          <span className="font-semibold text-slate-200">{RESEARCH_DISCLAIMER_TITLE}: </span>
          {RESEARCH_DISCLAIMER_SHORT}{" "}
          <Link href="/terms" className="text-blue-400 hover:underline">
            Terms of Service
          </Link>
          .
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-slate-800/80 pt-8 text-xs text-slate-500 sm:flex-row">
          <p>
            &copy; {currentYear} {config.branding.brandName}. All rights reserved.
          </p>
          <p>Payments processed securely in Nigerian Naira (₦) via Bachs.io.</p>
        </div>
      </div>
    </footer>
  );
}
