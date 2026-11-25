"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Package,
  Phone,
  RefreshCw,
  Settings,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Ticket,
  Wallet,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const CUSTOMER_NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/browse", label: "Browse Products", icon: ShoppingBag },
  { href: "/dashboard/vpns", label: "My VPNs", icon: Shield },
  { href: "/dashboard/proxies", label: "My Proxies", icon: Network },
  { href: "/dashboard/uk-numbers", label: "My UK Numbers", icon: Phone },
  { href: "/dashboard/orders", label: "My Orders", icon: Package },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/dashboard/renewals", label: "Renewals", icon: RefreshCw },
  { href: "/dashboard/tickets", label: "Support Tickets", icon: Ticket },
  { href: "/dashboard/settings", label: "Account Settings", icon: Settings },
];

interface DashboardShellProps {
  brandName: string;
  userEmail: string;
  isAdmin?: boolean;
  children: React.ReactNode;
}

export function DashboardShell({
  brandName,
  userEmail,
  isAdmin = false,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navContent = (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <Link href="/" className="text-base font-semibold text-white">
            {brandName}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="text-slate-400 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 p-3">
          {CUSTOMER_NAV.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-gradient-to-r from-blue-600/20 to-violet-600/20 text-white ring-1 ring-blue-500/30"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
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
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3.5 py-2 text-xs font-medium text-violet-200 hover:bg-violet-500/20"
          >
            <ShieldAlert className="h-4 w-4" />
            Switch to Admin Dashboard
          </Link>
        )}
        <div className="px-2 text-xs text-slate-500 truncate">{userEmail}</div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800/70 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#070B19]">
      <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-[#090F22] lg:block">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64 border-r border-slate-800 bg-[#090F22]">{navContent}</div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-[#090F22]/80 px-4 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg border border-slate-800 p-1.5 text-slate-300 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Customer Portal
          </span>
          <Link href="/shop" className="text-xs font-medium text-blue-400 hover:underline">
            Storefront &rarr;
          </Link>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
