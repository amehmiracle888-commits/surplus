import { PublicShell } from "@/components/layout/PublicShell";
import { RESEARCH_DISCLAIMER_FULL, RESEARCH_DISCLAIMER_TITLE } from "@/lib/product-notices";
import { getPublicSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Terms of Service" };

export default async function TermsPage() {
  const config = await getPublicSiteConfig();
  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-14 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-7">
          <h2 className="text-lg font-semibold text-white">{RESEARCH_DISCLAIMER_TITLE}</h2>
          <div className="mt-4 text-sm leading-relaxed whitespace-pre-line text-slate-200">
            {RESEARCH_DISCLAIMER_FULL}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-7 text-sm leading-relaxed whitespace-pre-line text-slate-300">
          {config.policies.terms}
        </div>
      </div>
    </PublicShell>
  );
}
