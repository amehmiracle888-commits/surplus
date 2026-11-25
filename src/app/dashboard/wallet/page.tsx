import { requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicSiteConfig } from "@/lib/site-config";
import { WalletClient } from "@/components/dashboard/WalletClient";

export const dynamic = "force-dynamic";

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const user = await requireCustomer();
  const params = await searchParams;
  const verifyReference = params.reference || params.trxref;
  const admin = createAdminClient();

  const [{ data: wallet }, { data: transactions }, config] = await Promise.all([
    admin.from("wallets").select("balance_kobo").eq("user_id", user.id).maybeSingle(),
    admin
      .from("wallet_transactions")
      .select("id, entry_type, category, amount_kobo, balance_after_kobo, reference, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    getPublicSiteConfig(),
  ]);

  return (
    <WalletClient
      balanceKobo={Number(wallet?.balance_kobo ?? 0)}
      minDepositNaira={config.payment_limits.minDepositNaira}
      maxDepositNaira={config.payment_limits.maxDepositNaira}
      transactions={transactions ?? []}
      verifyReference={verifyReference}
    />
  );
}
