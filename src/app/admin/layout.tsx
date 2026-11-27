import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { getPinLockState } from "@/lib/pin-lock";
import { getPublicSiteConfig } from "@/lib/site-config";
import { AdminShell } from "@/components/admin/AdminShell";
import { PinLockScreen } from "@/components/auth/PinLockScreen";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, config] = await Promise.all([
    getAuthenticatedUser(),
    getPublicSiteConfig(),
  ]);

  if (!user) {
    redirect("/login?redirect=/admin");
  }
  if (user.role !== "admin" && user.role !== "super_admin") {
    redirect("/dashboard");
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

  return (
    <AdminShell
      brandName={brandName}
      adminEmail={user.email}
      hasPin={pinState.hasPin}
    >
      {children}
    </AdminShell>
  );
}
