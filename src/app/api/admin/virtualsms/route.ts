import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { getBalance, getCountries, VirtualSmsError, type VirtualSmsCountry } from "@/lib/virtualsms";
import {
  clearVirtualSmsCatalogCache,
  DEFAULT_SMS_PRICING_CONFIG,
  getSmsPricingConfig,
} from "@/lib/virtualsms-pricing";

const PricingConfigSchema = z.object({
  usd_to_ngn_rate: z.number().positive().max(100_000),
  markup_percent: z.number().min(0).max(2000),
  flat_fee: z.number().min(0).max(1_000_000),
  enabled_countries: z
    .array(
      z.object({
        id: z.string().min(1).max(32),
        name: z.string().min(1).max(120),
      })
    )
    .min(1),
});

export async function GET() {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const config = await getSmsPricingConfig();

    let balanceUsd: number | null = null;
    let balanceError: string | null = null;
    let availableCountries: VirtualSmsCountry[] = DEFAULT_SMS_PRICING_CONFIG.enabled_countries;

    try {
      const [bal, countries] = await Promise.all([
        getBalance(),
        getCountries().catch(() => [] as VirtualSmsCountry[]),
      ]);
      balanceUsd = bal;
      if (countries.length > 0) {
        availableCountries = countries.sort((a, b) => a.name.localeCompare(b.name));
      }
    } catch (err) {
      balanceError =
        err instanceof VirtualSmsError
          ? err.message
          : "Unable to fetch live VirtualSMS balance.";
    }

    const { data: activations } = await admin
      .from("sms_activations")
      .select(
        "id, user_id, activation_id, service_code, service_name, country_id, country_name, phone_number, wholesale_usd, retail_price, status, sms_code, expires_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      config,
      balanceUsd,
      balanceError,
      availableCountries,
      activations: activations ?? [],
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[Admin VirtualSMS GET error]", err);
    return NextResponse.json({ error: "Failed to load VirtualSMS settings" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = await request.json();
    const parsed = PricingConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid pricing configuration", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const payload = {
      id: 1,
      usd_to_ngn_rate: parsed.data.usd_to_ngn_rate,
      markup_percent: parsed.data.markup_percent,
      flat_fee: parsed.data.flat_fee,
      enabled_countries: parsed.data.enabled_countries,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("sms_pricing_config")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    clearVirtualSmsCatalogCache();

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "virtualsms.pricing_update",
      entityType: "sms_pricing_config",
      entityId: "1",
      afterState: payload,
    });

    return NextResponse.json({ config: data });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[Admin VirtualSMS PATCH error]", err);
    return NextResponse.json({ error: "Failed to save pricing configuration" }, { status: 500 });
  }
}
