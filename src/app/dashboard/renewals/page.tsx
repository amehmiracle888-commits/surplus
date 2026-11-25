import { requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { RenewalsClient } from "@/components/dashboard/RenewalsClient";

export const dynamic = "force-dynamic";

export default async function RenewalsPage() {
  const user = await requireCustomer();
  const admin = createAdminClient();

  const [{ data: services }, { data: renewals }] = await Promise.all([
    admin
      .from("customer_services")
      .select("id, service_label, category_slug, status, expires_at, renewal_price_kobo")
      .eq("user_id", user.id)
      .order("expires_at", { ascending: true }),
    admin
      .from("renewals")
      .select("id, amount_kobo, duration_days, status, new_expires_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return <RenewalsClient services={services ?? []} renewals={renewals ?? []} />;
}
