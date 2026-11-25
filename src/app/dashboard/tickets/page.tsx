import { requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TicketsClient } from "@/components/dashboard/TicketsClient";

export const dynamic = "force-dynamic";

export default async function SupportTicketsPage() {
  const user = await requireCustomer();
  const admin = createAdminClient();

  const [{ data: tickets }, { data: orders }] = await Promise.all([
    admin
      .from("support_tickets")
      .select("*, messages:support_messages(*)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    admin
      .from("orders")
      .select("id, order_reference")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <TicketsClient
      userId={user.id}
      initialTickets={tickets ?? []}
      orders={orders ?? []}
    />
  );
}
