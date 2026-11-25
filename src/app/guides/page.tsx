import { BookOpen } from "lucide-react";
import { PublicShell } from "@/components/layout/PublicShell";
import { getPublicSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Setup Guides & Knowledge Base",
};

export default async function GuidesPage() {
  const config = await getPublicSiteConfig();

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/25">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Setup Guides &amp; Knowledge Base</h1>
            <p className="mt-1 text-sm text-slate-400">
              Step-by-step configuration guides for VPN clients, proxies, and UK virtual numbers.
            </p>
          </div>
        </div>

        <div className="mt-10 space-y-6">
          {config.setup_guides.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-8 text-center text-sm text-slate-400">
              No setup guides have been published yet.
            </div>
          ) : (
            config.setup_guides.map((guide) => (
              <article key={guide.id} className="rounded-2xl border border-slate-800 bg-[#0D1326] p-7">
                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-blue-300">
                  {guide.category}
                </span>
                <h2 className="mt-3 text-xl font-semibold text-white">{guide.title}</h2>
                <p className="mt-1.5 text-sm text-slate-400">{guide.summary}</p>
                <div className="mt-5 rounded-xl border border-slate-800 bg-[#070B19] p-5 text-sm leading-relaxed whitespace-pre-line text-slate-200">
                  {guide.content}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </PublicShell>
  );
}
