import { getAuthenticatedUser } from "@/lib/auth";
import { getPublicSiteConfig } from "@/lib/site-config";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const [config, user] = await Promise.all([
    getPublicSiteConfig(),
    getAuthenticatedUser().catch(() => null),
  ]);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  return (
    <div className="flex min-h-screen flex-col bg-[#070B19]">
      <Navbar config={config} isAuthenticated={Boolean(user)} isAdmin={isAdmin} />
      <main className="flex-1">{children}</main>
      <Footer config={config} />
    </div>
  );
}
