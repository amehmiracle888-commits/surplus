export type AppRole = "customer" | "admin" | "super_admin";
export type BillingCycle = "once" | "weekly" | "monthly" | "quarterly" | "biannual" | "annual" | "custom";
export type DeliveryMethod = "automated" | "manual";
export type AvailabilityStatus = "in_stock" | "low_stock" | "out_of_stock" | "discontinued";
export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "delivered"
  | "failed"
  | "cancelled"
  | "refunded";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type FulfilmentStatus = "pending" | "processing" | "delivered" | "failed" | "retrying";

export interface VpnMetadata {
  device_limit?: number;
  server_locations?: string[];
  protocols?: string[];
  renewable?: boolean;
  credential_type?: "account" | "activation_key" | "config_file";
  download_links?: { label: string; url: string }[];
}

export interface ProxyMetadata {
  proxy_type?:
    | "residential"
    | "static_residential"
    | "rotating_residential"
    | "mobile_4g_5g"
    | "isp"
    | "datacenter";
  countries?: string[];
  bandwidth_gb?: number | null;
  ip_count?: number | null;
  rotation_type?: "rotating" | "sticky" | "static";
  auth_methods?: string[];
  protocols?: ("HTTP" | "HTTPS" | "SOCKS5")[];
  supports_usage_api?: boolean;
}

export interface UkNumberMetadata {
  country_code: "+44";
  number_type: "dedicated" | "temporary";
  sms_capable: boolean;
  voice_capable: boolean;
  renewable?: boolean;
  compliance_notice?: string;
}

export interface ProductOptionSchema {
  key: string;
  label: string;
  type: "select" | "text" | "number";
  required?: boolean;
  options?: { label: string; value: string; price_delta_kobo?: number }[];
}

export interface PublicProduct {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  provider: string;
  short_description: string;
  description: string;
  image_url: string | null;
  terms_and_conditions: string;
  setup_instructions: string;
  billing_cycle: BillingCycle;
  duration_days: number;
  retail_price_kobo: number;
  renewal_price_kobo: number | null;
  delivery_method: DeliveryMethod;
  availability_status: AvailabilityStatus;
  stock_quantity: number | null;
  is_active: boolean;
  is_featured: boolean;
  is_popular: boolean;
  metadata: VpnMetadata & ProxyMetadata & Partial<UkNumberMetadata> & Record<string, unknown>;
  options_schema: ProductOptionSchema[];
  created_at: string;
  updated_at: string;
  category?: ProductCategory;
}

export interface AdminProduct extends PublicProduct {
  wholesale_cost_kobo: number;
  default_supplier_id: string | null;
}

export interface ProductCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

export interface BrandingSettings {
  brandName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
}

export interface HomepageSettings {
  heroHeadline: string;
  heroSubtext: string;
  primaryCta: string;
  secondaryCta: string;
  instantDeliveryTitle: string;
  instantDeliveryBody: string;
}

export interface ContactSettings {
  supportEmail: string;
  whatsappUrl: string;
  whatsappDisplay: string;
  telegramUrl: string;
  businessHours: string;
  officeLocation: string;
}

export interface PaymentLimitsSettings {
  minDepositNaira: number;
  maxDepositNaira: number;
  currency: string;
}

export interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface SetupGuideItem {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: string;
}

export interface PoliciesSettings {
  terms: string;
  privacy: string;
  refund: string;
}

export interface BannerSettings {
  enabled: boolean;
  text: string;
  href: string;
}

export interface SocialLinksSettings {
  twitter: string;
  telegram: string;
  instagram: string;
  linkedin: string;
}

export interface SiteConfig {
  branding: BrandingSettings;
  homepage: HomepageSettings;
  contact: ContactSettings;
  payment_limits: PaymentLimitsSettings;
  faqs: FaqItem[];
  setup_guides: SetupGuideItem[];
  policies: PoliciesSettings;
  banners: BannerSettings;
  social_links: SocialLinksSettings;
}
