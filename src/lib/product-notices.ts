import type { PublicProduct } from "@/types/database";

export const STRICT_USER_LIMIT_SHORT = "1 User (1 Device)";
export const STRICT_USER_LIMIT_LONG = "Strictly 1 User (1 Device per purchase)";
export const INSTANT_DELIVERY_TAG = "Instant Automated Delivery (5–30 mins)";

export const SHARED_LOGIN_HEADING = "SHARED LOGIN DETAILS";
export const SHARED_LOGIN_BODY =
  "These credentials belong to a shared login allocation strictly licensed for 1 user (1 device) per purchase. Do not change the account password, email, billing details, or security/2FA settings, and do not log in on multiple devices.";

export const RESEARCH_DISCLAIMER_TITLE = "Research & Legitimate Use Disclaimer";
export const RESEARCH_DISCLAIMER_SHORT =
  "All VPNs, proxies, and virtual numbers are provided strictly for authorized research, QA testing, privacy protection, and legitimate use, capped at 1 user (1 device) per purchase. Unlawful or abusive use is strictly prohibited.";

export const RESEARCH_DISCLAIMER_FULL = [
  "1. Authorized Research & Legitimate Use Only: All VPN subscriptions, proxy services, and virtual numbers provisioned on this platform are supplied strictly for lawful privacy protection, academic study, software QA testing, geo-verification, cybersecurity research with proper authorization, and legitimate business or personal workflows.",
  "2. Strictly 1 User / 1 Device Policy: Unless explicitly licensed otherwise in a written enterprise agreement, every product order grants access strictly to 1 user (1 concurrent device). Sharing purchased credentials outside your allocated session or connecting multiple concurrent devices may result in automatic suspension without refund.",
  "3. Shared Login Account Rules: Products clearly marked with SHARED LOGIN DETAILS provide managed shared credentials. Buyers must not change passwords, linked email addresses, recovery methods, subscription settings, or 2FA controls on shared accounts.",
  "4. Prohibited Conduct & Customer Responsibility: Customers are solely responsible for ensuring their usage complies with all applicable local and international laws as well as third-party platform terms. Fraud, unauthorized network intrusion, spamming, credential stuffing, abuse, or illegal activity is strictly prohibited and will lead to immediate termination and potential reporting where required by law.",
].join("\n\n");

export function hasSharedLogin(
  product: Pick<PublicProduct, "name" | "short_description" | "description" | "metadata" | "options_schema">
): boolean {
  if (product.metadata && product.metadata.shared_login === true) {
    return true;
  }

  for (const opt of product.options_schema ?? []) {
    if (
      opt.options?.some(
        (choice) => /shared/i.test(choice.value) || /shared/i.test(choice.label)
      )
    ) {
      return true;
    }
  }

  const combinedText = `${product.name} ${product.short_description} ${product.description}`;
  return /\bshared\s+(login|account|access|credentials)\b/i.test(combinedText);
}

export function isSharedOptionSelected(
  product: Pick<PublicProduct, "name" | "short_description" | "description" | "metadata" | "options_schema">,
  selectedOptions: Record<string, unknown>
): { offersShared: boolean; selectedIsShared: boolean } {
  const offersShared = hasSharedLogin(product);
  if (!offersShared) {
    return { offersShared: false, selectedIsShared: false };
  }

  for (const opt of product.options_schema ?? []) {
    const val = selectedOptions[opt.key];
    if (typeof val === "string" && opt.options && opt.options.length > 0) {
      const matched = opt.options.find((c) => c.value === val);
      if (matched) {
        return {
          offersShared: true,
          selectedIsShared: /shared/i.test(matched.value) || /shared/i.test(matched.label),
        };
      }
    }
  }

  return { offersShared: true, selectedIsShared: true };
}

export function hasServiceSharedLogin(params: {
  label?: string;
  metadata?: Record<string, unknown>;
  credentials?: Record<string, unknown>;
}): boolean {
  if (params.credentials?.shared_login === true || params.credentials?.account_type === "shared") {
    return true;
  }
  if (params.metadata?.shared_login === true || params.metadata?.account_type === "shared") {
    return true;
  }
  return Boolean(params.label && /\bshared\b/i.test(params.label));
}
