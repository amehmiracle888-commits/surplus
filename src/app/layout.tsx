import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getPublicSiteConfig } from "@/lib/site-config";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";

export const viewport: Viewport = {
  themeColor: "#070B19",
};

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfig();
  const brandName = config.branding.brandName || "IPcore";
  const pageTitle = `${brandName} — ${config.branding.tagline}`;
  const description = config.homepage.heroSubtext;
  const rawBaseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://ipcore.com.ng");

  return {
    metadataBase: new URL(rawBaseUrl),
    title: {
      default: pageTitle,
      template: `%s | ${brandName}`,
    },
    description,
    applicationName: brandName,
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/icon.png", sizes: "512x512", type: "image/png" },
        { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      ],
      shortcut: "/favicon.ico",
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      type: "website",
      siteName: brandName,
      title: pageTitle,
      description,
      images: [
        {
          url: "/icons/icon-512x512.png",
          width: 512,
          height: 512,
          alt: brandName,
        },
      ],
    },
    twitter: {
      card: "summary",
      title: pageTitle,
      description,
      images: ["/icons/icon-512x512.png"],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: brandName,
    },
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
        <PwaInstallPrompt brandName={config.branding.brandName || "IPcore"} />
      </body>
    </html>
  );
}
