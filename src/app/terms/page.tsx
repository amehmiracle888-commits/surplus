import { PublicShell } from "@/components/layout/PublicShell";
import { getPublicSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Terms of Service" };

export default async function TermsPage() {
  const config = await getPublicSiteConfig();
  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
        <div className="mt-6 rounded-2xl border border-slate-800 bg-[#0D1326] p-7 text-sm leading-relaxed whitespace-pre-line text-slate-300">
          {config.policies.terms}
        </div>
      </div>
    </PublicShell>
  );
}
