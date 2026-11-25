import { createClient } from "@/lib/supabase/server";
import { RESEARCH_DISCLAIMER_FULL } from "@/lib/product-notices";
import type { SiteConfig } from "@/types/database";

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  branding: {
    brandName: "Veltrix Digital",
    tagline: "Premium Digital Access Infrastructure",
    logoUrl: "",
    primaryColor: "#3B82F6",
    accentColor: "#8B5CF6",
    backgroundColor: "#070B19",
  },
  homepage: {
    heroHeadline: "Your Digital Essentials. One Destination.",
    heroSubtext:
      "Premium VPN subscriptions, reliable proxy services and UK virtual numbers. Get the digital services you need with secure payments and automated delivery.",
    primaryCta: "Explore Products",
    secondaryCta: "Create Account",
    instantDeliveryTitle: "Automated Provisioning After Verified Payment",
    instantDeliveryBody:
      "Once Bachs.io confirms your payment or your wallet is debited, our backend connects directly to the configured supplier API or operations queue to provision your service and deliver credentials into your dashboard and inbox.",
  },
  contact: {
    supportEmail: "",
    whatsappUrl: "",
    whatsappDisplay: "",
    telegramUrl: "",
    businessHours: "Mon - Sat, 8:00 AM - 8:00 PM WAT",
    officeLocation: "Lagos, Nigeria",
  },
  payment_limits: {
    minDepositNaira: 500,
    maxDepositNaira: 5000000,
    currency: "NGN",
  },
  banners: {
    enabled: false,
    text: "",
    href: "/shop",
  },
  social_links: {
    twitter: "",
    telegram: "",
    instagram: "",
    linkedin: "",
  },
  faqs: [],
  setup_guides: [],
  policies: {
    terms: RESEARCH_DISCLAIMER_FULL,
    privacy: "We process only the personal data required for authentication, billing, and fulfilment.",
    refund: "Confirmed fulfilment failures are automatically credited back to your wallet or refunded.",
  },
};

export async function getPublicSiteConfig(): Promise<SiteConfig> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("website_settings")
      .select("key, value")
      .eq("is_public", true);

    if (error || !data) {
      return DEFAULT_SITE_CONFIG;
    }

    const merged: SiteConfig = structuredClone(DEFAULT_SITE_CONFIG);
    for (const row of data) {
      const key = row.key as keyof SiteConfig;
      if (key in merged && row.value !== null && row.value !== undefined) {
        if (Array.isArray(merged[key]) && Array.isArray(row.value)) {
          (merged as unknown as Record<string, unknown>)[key] = row.value;
        } else if (typeof merged[key] === "object" && typeof row.value === "object") {
          (merged as unknown as Record<string, unknown>)[key] = {
            ...(merged[key] as unknown as Record<string, unknown>),
            ...(row.value as Record<string, unknown>),
          };
        }
      }
    }
    return merged;
  } catch {
    return DEFAULT_SITE_CONFIG;
  }
}
