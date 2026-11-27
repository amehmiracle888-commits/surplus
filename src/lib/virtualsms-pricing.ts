import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCountries,
  getPrices,
  getServicesList,
  type VirtualSmsCountry,
  type VirtualSmsPricesMap,
  type VirtualSmsService,
} from "@/lib/virtualsms";

export interface EnabledCountryConfig {
  id: string;
  name: string;
}

export interface SmsPricingConfig {
  usd_to_ngn_rate: number;
  markup_percent: number;
  flat_fee: number;
  enabled_countries: EnabledCountryConfig[];
  updated_at?: string;
}

export const DEFAULT_SMS_PRICING_CONFIG: SmsPricingConfig = {
  usd_to_ngn_rate: 1600,
  markup_percent: 40,
  flat_fee: 0,
  enabled_countries: [
    { id: "187", name: "United States" },
    { id: "16", name: "United Kingdom" },
  ],
};

const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedVirtualSmsData {
  prices: VirtualSmsPricesMap;
  services: VirtualSmsService[];
  countries: VirtualSmsCountry[];
  fetchedAt: number;
}

let catalogCache: CachedVirtualSmsData | null = null;

export function clearVirtualSmsCatalogCache() {
  catalogCache = null;
}

/**
 * Computes marked-up NGN retail price using the exact required formula:
 * Math.ceil((wholesaleUsd * usd_to_ngn_rate) * (1 + markup_percent / 100) + flat_fee)
 */
export function calculateRetailPriceNaira(params: {
  wholesaleUsd: number;
  usdToNgnRate: number;
  markupPercent: number;
  flatFee: number;
}): number {
  const { wholesaleUsd, usdToNgnRate, markupPercent, flatFee } = params;
  return Math.ceil(wholesaleUsd * usdToNgnRate * (1 + markupPercent / 100) + flatFee);
}

export async function getSmsPricingConfig(): Promise<SmsPricingConfig> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("sms_pricing_config")
      .select("usd_to_ngn_rate, markup_percent, flat_fee, enabled_countries, updated_at")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_SMS_PRICING_CONFIG;
    }

    const enabledCountries = Array.isArray(data.enabled_countries)
      ? (data.enabled_countries as unknown[])
          .map((entry) => {
            if (typeof entry === "string") {
              return { id: entry, name: entry };
            }
            if (entry && typeof entry === "object") {
              const obj = entry as Record<string, unknown>;
              return {
                id: String(obj.id ?? "").trim(),
                name: String(obj.name ?? obj.id ?? "").trim(),
              };
            }
            return null;
          })
          .filter((c): c is EnabledCountryConfig => Boolean(c && c.id))
      : DEFAULT_SMS_PRICING_CONFIG.enabled_countries;

    return {
      usd_to_ngn_rate: Number(data.usd_to_ngn_rate) || DEFAULT_SMS_PRICING_CONFIG.usd_to_ngn_rate,
      markup_percent: Number(data.markup_percent) ?? DEFAULT_SMS_PRICING_CONFIG.markup_percent,
      flat_fee: Number(data.flat_fee) || 0,
      enabled_countries:
        enabledCountries.length > 0 ? enabledCountries : DEFAULT_SMS_PRICING_CONFIG.enabled_countries,
      updated_at: data.updated_at ? String(data.updated_at) : undefined,
    };
  } catch {
    return DEFAULT_SMS_PRICING_CONFIG;
  }
}

export async function getCachedVirtualSmsCatalogData(): Promise<CachedVirtualSmsData> {
  if (catalogCache && Date.now() - catalogCache.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return catalogCache;
  }

  const [prices, services, countries] = await Promise.all([
    getPrices(),
    getServicesList(),
    getCountries().catch(() => [] as VirtualSmsCountry[]),
  ]);

  catalogCache = {
    prices,
    services,
    countries,
    fetchedAt: Date.now(),
  };

  return catalogCache;
}

/**
 * Matches a configured country (by ID or fuzzy name alias like USA / United States / UK / United Kingdom / England)
 * against live VirtualSMS country IDs returned by getCountries() and getPrices().
 */
export function resolveEnabledCountries(
  configured: EnabledCountryConfig[],
  liveCountries: VirtualSmsCountry[],
  livePriceCountryIds: string[]
): EnabledCountryConfig[] {
  const liveById = new Map(liveCountries.map((c) => [c.id, c.name]));
  const priceSet = new Set(livePriceCountryIds);
  const resolved: EnabledCountryConfig[] = [];
  const seen = new Set<string>();

  for (const cfg of configured) {
    let matchedId = cfg.id;
    let matchedName = liveById.get(cfg.id) || cfg.name || cfg.id;

    // If configured ID isn't directly in live prices, match by normalized name aliases
    if (!priceSet.has(matchedId) && liveCountries.length > 0) {
      const targetLower = cfg.name.toLowerCase();
      const aliases = targetLower.includes("united states") || targetLower === "usa" || targetLower === "us"
        ? ["united states", "usa"]
        : targetLower.includes("united kingdom") || targetLower === "uk" || targetLower === "england"
          ? ["united kingdom", "england", "great britain", "uk"]
          : [targetLower];

      const found = liveCountries.find((lc) => {
        const ln = lc.name.toLowerCase();
        return aliases.some((a) => ln === a || ln.includes(a));
      });
      if (found) {
        matchedId = found.id;
        matchedName = found.name;
      }
    }

    if (!seen.has(matchedId)) {
      seen.add(matchedId);
      resolved.push({ id: matchedId, name: matchedName });
    }
  }

  return resolved;
}
