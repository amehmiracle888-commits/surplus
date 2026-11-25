import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { getPublicSiteConfig } from "@/lib/site-config";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, config] = await Promise.all([
    getAuthenticatedUser(),
    getPublicSiteConfig(),
  ]);

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const isAdmin = user.role === "admin" || user.role === "super_admin";

  return (
    <DashboardShell
      brandName={config.branding.brandName}
      userEmail={user.email}
      isAdmin={isAdmin}
    >
      {children}
    </DashboardShell>
  );
}
