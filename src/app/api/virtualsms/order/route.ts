import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { generateReference, nairaToKobo } from "@/lib/utils";
import { getNumberV2, getPrices, setStatus, VirtualSmsError } from "@/lib/virtualsms";
import {
  calculateRetailPriceNaira,
  getCachedVirtualSmsCatalogData,
  getSmsPricingConfig,
  resolveEnabledCountries,
} from "@/lib/virtualsms-pricing";

const OrderSchema = z.object({
  serviceCode: z.string().min(1).max(32),
  countryId: z.string().min(1).max(32),
});

export async function POST(request: Request) {
  try {
    const user = await requireCustomer();
    const ip = getClientIp(request);
    const rl = checkRateLimit(`virtualsms-order:${user.id}:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many number requests. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = OrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid VirtualSMS order request.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { serviceCode, countryId } = parsed.data;
    const admin = createAdminClient();

    const [config, livePrices, catalogMeta] = await Promise.all([
      getSmsPricingConfig(),
      getPrices(countryId, serviceCode),
      getCachedVirtualSmsCatalogData().catch(() => null),
    ]);

    const allowedCountries = resolveEnabledCountries(
      config.enabled_countries,
      catalogMeta?.countries ?? [],
      Object.keys(livePrices)
    );
    const matchedCountry = allowedCountries.find((c) => c.id === countryId);
    if (!matchedCountry) {
      return NextResponse.json(
        { error: "Selected country is not currently enabled." },
        { status: 400 }
      );
    }

    const priceInfo = livePrices[countryId]?.[serviceCode];
    if (!priceInfo || priceInfo.count <= 0 || priceInfo.cost <= 0) {
      return NextResponse.json(
        { error: "No numbers are currently available for this service and country." },
        { status: 409 }
      );
    }

    const wholesaleUsd = priceInfo.cost;
    const retailPrice = calculateRetailPriceNaira({
      wholesaleUsd,
      usdToNgnRate: config.usd_to_ngn_rate,
      markupPercent: config.markup_percent,
      flatFee: config.flat_fee,
    });
    const amountKobo = nairaToKobo(retailPrice);

    const serviceName =
      catalogMeta?.services.find((s) => s.code.toLowerCase() === serviceCode.toLowerCase())?.name ||
      serviceCode.toUpperCase();

    const debitRef = generateReference("SMS-ORD");

    // 1) Atomically deduct wallet balance first
    const { error: debitErr } = await admin.rpc("apply_wallet_ledger_entry", {
      p_user_id: user.id,
      p_entry_type: "debit",
      p_category: "purchase",
      p_amount_kobo: amountKobo,
      p_reference: debitRef,
      p_description: `VirtualSMS number: ${serviceName} (${matchedCountry.name})`,
      p_metadata: { serviceCode, countryId, wholesaleUsd, retailPrice },
    });

    if (debitErr) {
      return NextResponse.json(
        {
          error: debitErr.message.includes("Insufficient wallet balance")
            ? `Insufficient wallet balance. Required: ₦${retailPrice.toLocaleString("en-NG")}. Please fund your wallet first.`
            : debitErr.message,
        },
        { status: 400 }
      );
    }

    // 2) Provision number via VirtualSMS (refund immediately on failure)
    let numberResult;
    try {
      numberResult = await getNumberV2(serviceCode, countryId);
    } catch (providerErr) {
      await admin.rpc("apply_wallet_ledger_entry", {
        p_user_id: user.id,
        p_entry_type: "credit",
        p_category: "refund",
        p_amount_kobo: amountKobo,
        p_reference: `REFUND-${debitRef}`,
        p_description: `Auto-refund: VirtualSMS failed for ${serviceName} (${matchedCountry.name})`,
        p_metadata: { original_reference: debitRef },
      });

      if (providerErr instanceof VirtualSmsError) {
        return NextResponse.json(
          { error: providerErr.message },
          { status: providerErr.httpStatus }
        );
      }
      throw providerErr;
    }

    const actualWholesaleUsd =
      numberResult.wholesaleCostUsd > 0 ? numberResult.wholesaleCostUsd : wholesaleUsd;
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();

    const { data: activation, error: insertErr } = await admin
      .from("sms_activations")
      .insert({
        user_id: user.id,
        activation_id: numberResult.activationId,
        service_code: serviceCode,
        service_name: serviceName,
        country_id: countryId,
        country_name: matchedCountry.name,
        phone_number: numberResult.phoneNumber,
        wholesale_usd: actualWholesaleUsd,
        retail_price: retailPrice,
        status: "pending",
        expires_at: expiresAt,
      })
      .select(
        "id, activation_id, service_code, service_name, country_id, country_name, phone_number, retail_price, status, sms_code, sms_text, expires_at, created_at"
      )
      .single();

    if (insertErr || !activation) {
      // Best-effort upstream cancel + immediate refund if DB insert fails
      await setStatus(numberResult.activationId, 8).catch(() => null);
      await admin.rpc("apply_wallet_ledger_entry", {
        p_user_id: user.id,
        p_entry_type: "credit",
        p_category: "refund",
        p_amount_kobo: amountKobo,
        p_reference: `DBERR-REFUND-${debitRef}`,
        p_description: `Auto-refund: failed to record VirtualSMS order ${numberResult.activationId}`,
        p_metadata: { activation_id: numberResult.activationId },
      });

      return NextResponse.json(
        { error: "Failed to save activation record. Your wallet has been refunded." },
        { status: 500 }
      );
    }

    await writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: "virtualsms.order",
      entityType: "sms_activation",
      entityId: activation.id,
      afterState: {
        activation_id: activation.activation_id,
        service_code: serviceCode,
        country_id: countryId,
        retail_price: retailPrice,
      },
    });

    return NextResponse.json({
      activation,
      activationId: activation.activation_id,
      phoneNumber: activation.phone_number,
      expiresAt: activation.expires_at,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof VirtualSmsError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    console.error("[VirtualSMS order error]", err);
    return NextResponse.json(
      { error: "Unable to complete VirtualSMS order right now." },
      { status: 500 }
    );
  }
}
