import { NextResponse } from "next/server";
import { VirtualSmsError } from "@/lib/virtualsms";
import {
  calculateRetailPriceNaira,
  getCachedVirtualSmsCatalogData,
  getSmsPricingConfig,
  resolveEnabledCountries,
} from "@/lib/virtualsms-pricing";

export const revalidate = 300;

export interface PublicCatalogItem {
  countryId: string;
  countryName: string;
  serviceCode: string;
  serviceName: string;
  count: number;
  retailPrice: number;
}

const POPULAR_SERVICE_ORDER = [
  "wa", // WhatsApp
  "tg", // Telegram
  "go", // Google / Gmail
  "ig", // Instagram
  "fb", // Facebook
  "oi", // OpenAI / ChatGPT
  "lf", // TikTok
  "ds", // Discord
  "tw", // Twitter / X
  "ub", // Uber
  "ts", // PayPal
  "am", // Amazon
];

export async function GET() {
  try {
    const [config, cached] = await Promise.all([
      getSmsPricingConfig(),
      getCachedVirtualSmsCatalogData(),
    ]);

    const serviceNameMap = new Map(cached.services.map((s) => [s.code.toLowerCase(), s.name]));
    const resolvedCountries = resolveEnabledCountries(
      config.enabled_countries,
      cached.countries,
      Object.keys(cached.prices)
    );

    const items: PublicCatalogItem[] = [];

    for (const country of resolvedCountries) {
      const countryPrices = cached.prices[country.id];
      if (!countryPrices) continue;

      for (const [serviceCode, info] of Object.entries(countryPrices)) {
        if (!info || info.count <= 0 || info.cost <= 0) continue;

        const retailPrice = calculateRetailPriceNaira({
          wholesaleUsd: info.cost,
          usdToNgnRate: config.usd_to_ngn_rate,
          markupPercent: config.markup_percent,
          flatFee: config.flat_fee,
        });

        items.push({
          countryId: country.id,
          countryName: country.name,
          serviceCode,
          serviceName: serviceNameMap.get(serviceCode.toLowerCase()) || serviceCode.toUpperCase(),
          count: info.count,
          retailPrice,
        });
      }
    }

    items.sort((a, b) => {
      const ia = POPULAR_SERVICE_ORDER.indexOf(a.serviceCode.toLowerCase());
      const ib = POPULAR_SERVICE_ORDER.indexOf(b.serviceCode.toLowerCase());
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.serviceName.localeCompare(b.serviceName);
    });

    return NextResponse.json({
      configured: true,
      countries: resolvedCountries,
      items,
      cachedAt: new Date(cached.fetchedAt).toISOString(),
    });
  } catch (err) {
    if (err instanceof VirtualSmsError) {
      return NextResponse.json(
        {
          configured: err.code !== "MISSING_API_KEY",
          error: err.message,
          countries: [],
          items: [],
        },
        { status: err.httpStatus }
      );
    }

    console.error("[VirtualSMS catalog error]", err);
    return NextResponse.json(
      {
        configured: true,
        error: "Unable to load live VirtualSMS catalog right now.",
        countries: [],
        items: [],
      },
      { status: 500 }
    );
  }
}
