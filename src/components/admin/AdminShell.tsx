"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Globe,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Package,
  Phone,
  PlugZap,
  ShoppingBag,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand/BrandLogo";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: ShoppingBag },
  { href: "/admin/virtual-numbers", label: "SMS Pricing & OTP", icon: Phone },
  { href: "/admin/suppliers", label: "Suppliers & APIs", icon: PlugZap },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/finance", label: "Finance & Reports", icon: BarChart3 },
  { href: "/admin/tickets", label: "Support Tickets", icon: Ticket },
  { href: "/admin/website", label: "Website & Emails", icon: Globe },
];

export function AdminShell({
  brandName,
  adminEmail,
  hasPin = false,
  children,
}: {
  brandName: string;
  adminEmail: string;
  hasPin?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function lockScreen() {
    await fetch("/api/auth/pin/lock", { method: "POST" }).catch(() => null);
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/pin/lock", { method: "POST" }).catch(() => null);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const nav = (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <BrandLogo brandName={brandName} size="sm" subtitle="Admin Console" />
          <button type="button" onClick={() => setOpen(false)} className="text-slate-400 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 p-3">
          {ADMIN_NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-gradient-to-r from-violet-600/25 to-blue-600/20 text-white ring-1 ring-violet-500/35"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-800 p-4 space-y-2">
        <Link
          href="/dashboard"
          className="block rounded-xl border border-slate-700 px-3.5 py-2 text-center text-xs font-medium text-slate-300 hover:border-slate-500"
        >
          Customer Portal
        </Link>
        <div className="truncate px-1 text-xs text-slate-500">{adminEmail}</div>
        {hasPin && (
          <button
            type="button"
            onClick={lockScreen}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2 text-xs font-medium text-blue-300 hover:border-blue-500/40 hover:text-white"
          >
            <Lock className="h-3.5 w-3.5" /> Lock Screen
          </button>
        )}
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-xl px-3.5 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#070B19]">
      <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-[#090F22] lg:block">
        {nav}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64 border-r border-slate-800 bg-[#090F22]">{nav}</div>
          <div className="flex-1 bg-black/60" onClick={() => setOpen(false)} />
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-[#090F22]/80 px-4 lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-slate-800 p-1.5 text-slate-300 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">
            Administrator Operations
          </span>
          <Link href="/" className="text-xs text-blue-400 hover:underline">
            View Website &rarr;
          </Link>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
