import { ProductCatalogView } from "@/components/storefront/ProductCatalogView";
import { getPublicProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function DashboardBrowsePage() {
  const products = await getPublicProducts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Browse Products</h1>
        <p className="mt-1 text-sm text-slate-400">
          Select a plan to purchase instantly using your wallet or Paystack.
        </p>
      </div>
      <ProductCatalogView products={products} />
    </div>
  );
}
