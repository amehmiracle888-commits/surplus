import type { Metadata } from "next";
import "./globals.css";
import { getPublicSiteConfig } from "@/lib/site-config";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfig();
  return {
    title: {
      default: `${config.branding.brandName} — ${config.branding.tagline}`,
      template: `%s | ${config.branding.brandName}`,
    },
    description: config.homepage.heroSubtext,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await getPublicSiteConfig();

  return (
    <html lang="en" className="dark">
      <body
        className="min-h-screen bg-[#070B19] text-slate-100 antialiased selection:bg-blue-500/30 selection:text-white"
        style={
          {
            "--brand-primary": config.branding.primaryColor || "#3B82F6",
            "--brand-accent": config.branding.accentColor || "#8B5CF6",
            "--bg-canvas": config.branding.backgroundColor || "#070B19",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
