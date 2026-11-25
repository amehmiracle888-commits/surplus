import { Shield } from "lucide-react";
import { PublicShell } from "@/components/layout/PublicShell";
import { ProductCatalogView } from "@/components/storefront/ProductCatalogView";
import { getPublicProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "VPN Subscriptions",
};

export default async function VpnPage() {
  const products = await getPublicProducts({ categorySlug: "vpn" });

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/25">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">VPN Subscriptions</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Encrypted VPN accounts and activation keys across monthly, quarterly, six-month, and
              annual plans with transparent device limits and server locations.
            </p>
          </div>
        </div>

        <ProductCatalogView
          products={products}
          categoryFilter="vpn"
          emptyTitle="No VPN plans published yet"
          emptySubtitle="Active VPN subscriptions added in the Admin Dashboard will appear here."
        />
      </div>
    </PublicShell>
  );
}
