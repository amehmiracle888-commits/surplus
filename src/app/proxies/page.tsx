import { Network } from "lucide-react";
import { PublicShell } from "@/components/layout/PublicShell";
import { ProductCatalogView } from "@/components/storefront/ProductCatalogView";
import { getPublicProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Proxy Services",
};

export default async function ProxiesPage() {
  const products = await getPublicProducts({ categorySlug: "proxy" });

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/25">
            <Network className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Proxy Services</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Residential, static residential, rotating residential, mobile 4G/5G, ISP, and
              datacenter proxies showing verified protocols, rotation modes, and bandwidth options.
            </p>
          </div>
        </div>

        <ProductCatalogView
          products={products}
          categoryFilter="proxy"
          emptyTitle="No proxy plans published yet"
          emptySubtitle="Active proxy products added in the Admin Dashboard will appear here."
        />
      </div>
    </PublicShell>
  );
}
