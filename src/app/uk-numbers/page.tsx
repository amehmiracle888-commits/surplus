import { AlertTriangle, Phone } from "lucide-react";
import { PublicShell } from "@/components/layout/PublicShell";
import { ProductCatalogView } from "@/components/storefront/ProductCatalogView";
import { getPublicProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "UK Virtual Numbers (+44)",
};

export default async function UkNumbersPage() {
  const products = await getPublicProducts({ categorySlug: "uk-number" });

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/25">
            <Phone className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">UK Virtual Numbers (+44)</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Dedicated renewable and temporary +44 UK virtual numbers with explicitly disclosed SMS
              and Voice capabilities.
            </p>
          </div>
        </div>

        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p>
            <strong>Capability &amp; Compatibility Notice:</strong> Each listing reflects exact
            supplier-supported SMS or Voice capabilities. Voice-only numbers do not receive SMS, and
            acceptance by third-party verification services is never guaranteed.
          </p>
        </div>

        <ProductCatalogView
          products={products}
          categoryFilter="uk-number"
          emptyTitle="No UK (+44) virtual number plans published yet"
          emptySubtitle="Active UK number offerings configured in the Admin Dashboard will appear here."
        />
      </div>
    </PublicShell>
  );
}
