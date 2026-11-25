import { PublicShell } from "@/components/layout/PublicShell";
import { ProductCatalogView } from "@/components/storefront/ProductCatalogView";
import { getPublicProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "All Products",
};

export default async function ShopPage() {
  const products = await getPublicProducts();

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Catalogue</p>
          <h1 className="mt-1 text-3xl font-bold text-white">All Digital Products</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Browse active VPN subscriptions, proxy services, and UK (+44) virtual numbers priced in
            Nigerian Naira (₦).
          </p>
        </div>

        <ProductCatalogView products={products} />
      </div>
    </PublicShell>
  );
}
