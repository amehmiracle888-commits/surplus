import { requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsClient } from "@/components/dashboard/SettingsClient";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const user = await requireCustomer();
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name, phone, country")
    .eq("id", user.id)
    .single();

  return (
    <SettingsClient
      email={profile?.email || user.email}
      initialFullName={profile?.full_name || ""}
      initialPhone={profile?.phone || ""}
      initialCountry={profile?.country || "NG"}
    />
  );
}
