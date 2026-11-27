import { PublicShell } from "@/components/layout/PublicShell";
import { VirtualNumbersClient, type ActivationRecord } from "@/components/virtualsms/VirtualNumbersClient";
import { getAuthenticatedUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Instant OTP Virtual Numbers",
};

export default async function VirtualNumbersPage() {
  const user = await getAuthenticatedUser().catch(() => null);
  let walletBalanceKobo: number | null = null;
  let initialActivations: ActivationRecord[] = [];

  if (user) {
    const admin = createAdminClient();
    const [{ data: wallet }, { data: activations }] = await Promise.all([
      admin.from("wallets").select("balance_kobo").eq("user_id", user.id).maybeSingle(),
      admin
        .from("sms_activations")
        .select(
          "id, activation_id, service_code, service_name, country_id, country_name, phone_number, retail_price, status, sms_code, sms_text, expires_at, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    walletBalanceKobo = Number(wallet?.balance_kobo ?? 0);
    initialActivations = (activations ?? []) as ActivationRecord[];
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <VirtualNumbersClient
          isAuthenticated={Boolean(user)}
          initialWalletKobo={walletBalanceKobo}
          initialActivations={initialActivations}
        />
      </div>
    </PublicShell>
  );
}
