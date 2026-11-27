import { requireCustomer } from "@/lib/auth";
import { getPinLockState } from "@/lib/pin-lock";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsClient } from "@/components/dashboard/SettingsClient";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const user = await requireCustomer();
  const admin = createAdminClient();
  const [{ data: profile }, pinState] = await Promise.all([
    admin
      .from("profiles")
      .select("email, full_name, phone, country")
      .eq("id", user.id)
      .single(),
    getPinLockState(user.id),
  ]);

  return (
    <SettingsClient
      email={profile?.email || user.email}
      initialFullName={profile?.full_name || ""}
      initialPhone={profile?.phone || ""}
      initialCountry={profile?.country || "NG"}
      initialHasPin={pinState.hasPin}
      pinSchemaReady={pinState.schemaReady}
    />
  );
}
