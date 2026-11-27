import Link from "next/link";
import { ArrowRight, CheckCircle2, CreditCard, KeyRound, Server, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/layout/PublicShell";

export const metadata = {
  title: "How It Works",
};

export default function HowItWorksPage() {
  const steps = [
    {
      icon: ShieldCheck,
      title: "1. Browse Real-Time Supplier Offerings",
      body: "Explore VPN subscriptions, proxy packages, and +44 UK virtual numbers. Every product displays verified capabilities, billing cycle, delivery mode, and Nigerian Naira (₦) pricing.",
    },
    {
      icon: CreditCard,
      title: "2. Pay Securely in Nigerian Naira (₦)",
      body: "Pay directly with Paystack (Nigerian debit cards, bank transfer, USSD) or fund your customer wallet for instant one-click checkout. Every payment is verified server-side.",
    },
    {
      icon: Server,
      title: "3. Instant Automated Delivery (5–30 mins)",
      body: "Once payment is confirmed, our backend routes provisioning automatically with idempotency protection and delivers credentials within 5 to 30 minutes.",
    },
    {
      icon: KeyRound,
      title: "4. Access Credentials & Renewals in Your Dashboard",
      body: "View encrypted VPN credentials, proxy connection strings, or UK number controls inside your private Customer Dashboard, complete with expiry reminders and renewal controls.",
    },
  ];

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Architecture</p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">How the Platform Works</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Built for reliability and financial integrity: zero client-side payment trust, auditable
          wallet ledger entries, and automated supplier API provisioning.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {steps.map((s) => (
            <div key={s.title} className="rounded-2xl border border-slate-800 bg-[#0D1326] p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/25">
                <s.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-white">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-slate-800 bg-[#0D1326] p-7">
          <h2 className="text-lg font-semibold text-white">Order Failure Protection</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            If an upstream supplier API is temporarily unreachable or rejects provisioning, the
            platform never marks your order as delivered. Transient errors are retried automatically,
            and confirmed failures are credited back to your Naira wallet or refunded.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Signed Paystack Webhooks
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Idempotent Order Processing
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Encrypted Credential Storage
            </span>
          </div>
          <div className="mt-6">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-medium text-white"
            >
              Explore Products <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
