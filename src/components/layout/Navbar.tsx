"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, ArrowRight, LayoutDashboard } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import type { SiteConfig } from "@/types/database";

interface NavbarProps {
  config: SiteConfig;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
}

const NAV_LINKS = [
  { href: "/shop", label: "All Products" },
  { href: "/vpn", label: "VPN Subscriptions" },
  { href: "/proxies", label: "Proxy Services" },
  { href: "/virtual-numbers", label: "OTP Numbers" },
  { href: "/uk-numbers", label: "UK Numbers" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/guides", label: "Setup Guides" },
  { href: "/contact", label: "Support" },
];

export function Navbar({ config, isAuthenticated = false, isAdmin = false }: NavbarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070B19]/90 backdrop-blur-md">
      {config.banners.enabled && config.banners.text && (
        <div className="bg-gradient-to-r from-blue-600/20 via-violet-600/20 to-blue-600/20 border-b border-blue-500/20 px-4 py-1.5 text-center text-xs text-slate-200">
          <Link href={config.banners.href || "/shop"} className="hover:underline">
            {config.banners.text}
          </Link>
        </div>
      )}

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center">
          <BrandLogo
            brandName={config.branding.brandName}
            logoUrl={config.branding.logoUrl}
            size="md"
          />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-slate-800/80 text-white"
                    : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3.5 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-110"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-300 transition hover:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-110"
              >
                Create Account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Toggle Menu"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-slate-800 p-2 text-slate-300 hover:text-white lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-800 bg-[#0A0F22] px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800/70"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-800 pt-3">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2.5 text-center text-sm font-medium text-white"
                >
                  Open Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-slate-700 px-4 py-2.5 text-center text-sm font-medium text-slate-200"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2.5 text-center text-sm font-medium text-white"
                  >
                    Create Account
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
