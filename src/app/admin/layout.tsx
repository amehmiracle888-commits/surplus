import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { getPublicSiteConfig } from "@/lib/site-config";
import { AdminShell } from "@/components/admin/AdminShell";

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

  return (
    <AdminShell brandName={config.branding.brandName} adminEmail={user.email}>
      {children}
    </AdminShell>
  );
}
