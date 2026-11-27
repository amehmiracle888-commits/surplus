import { HelpCircle } from "lucide-react";
import { PublicShell } from "@/components/layout/PublicShell";
import { getPublicSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "FAQ",
};

export default async function FaqPage() {
  const config = await getPublicSiteConfig();

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/25">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Frequently Asked Questions</h1>
            <p className="mt-1 text-sm text-slate-400">
              Answers about Naira payments, Bachs.io verification, instant automated delivery (5–30 mins), and service rules.
            </p>
          </div>
        </div>

        <div className="mt-10 space-y-4">
          {config.faqs.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-8 text-center text-sm text-slate-400">
              No FAQs have been published yet.
            </div>
          ) : (
            config.faqs.map((faq) => (
              <div key={faq.id} className="rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
                <span className="text-xs font-medium uppercase tracking-wider text-blue-400">
                  {faq.category}
                </span>
                <h2 className="mt-1 text-base font-semibold text-white">{faq.question}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{faq.answer}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </PublicShell>
  );
}
