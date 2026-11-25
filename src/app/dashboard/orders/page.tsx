import { requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { OrdersClient } from "@/components/dashboard/OrdersClient";

export const dynamic = "force-dynamic";

export default async function MyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const user = await requireCustomer();
  const params = await searchParams;
  const verifyReference = params.reference || params.trxref;
  const admin = createAdminClient();

  const { data: orders } = await admin
    .from("orders")
    .select(
      "id, order_reference, status, payment_status, payment_method, total_kobo, created_at, items:order_items(id, product_name, quantity, category_slug)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <OrdersClient initialOrders={orders ?? []} verifyReference={verifyReference} />;
}
