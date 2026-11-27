import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { getPinLockState } from "@/lib/pin-lock";
import { getPublicSiteConfig } from "@/lib/site-config";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PinLockScreen } from "@/components/auth/PinLockScreen";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, config] = await Promise.all([
    getAuthenticatedUser(),
    getPublicSiteConfig(),
  ]);

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const pinState = await getPinLockState(user.id);
  const brandName = config.branding.brandName || "IPcore";

  if (pinState.schemaReady && pinState.hasPin && !pinState.unlocked) {
    return (
      <PinLockScreen
        mode="unlock"
        brandName={brandName}
        userEmail={user.email}
      />
    );
  }

  const isAdmin = user.role === "admin" || user.role === "super_admin";

  return (
    <DashboardShell
      brandName={brandName}
      userEmail={user.email}
      isAdmin={isAdmin}
      hasPin={pinState.hasPin}
      showPinSetupPrompt={pinState.schemaReady && !pinState.hasPin}
    >
      {children}
    </DashboardShell>
  );
}
