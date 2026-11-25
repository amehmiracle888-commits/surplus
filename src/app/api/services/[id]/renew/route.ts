import { NextResponse } from "next/server";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSupplierContext, getSupplierAdapter, type SupplierDbRow } from "@/lib/suppliers/registry";
import { sendNotification } from "@/lib/notifications";
import { formatNaira, generateReference } from "@/lib/utils";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCustomer();
    const { id } = await context.params;
    const admin = createAdminClient();

    const { data: service } = await admin
      .from("customer_services")
      .select("*, product:products(duration_days, renewal_price_kobo, retail_price_kobo, delivery_method), supplier:suppliers(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const product = service.product as {
      duration_days: number;
      renewal_price_kobo: number | null;
      retail_price_kobo: number;
      delivery_method: string;
    } | null;

    const renewalAmountKobo = service.renewal_price_kobo ?? product?.renewal_price_kobo ?? product?.retail_price_kobo;
    if (!renewalAmountKobo || renewalAmountKobo <= 0) {
      return NextResponse.json({ error: "This service is not configured for renewal" }, { status: 400 });
    }

    const durationDays = product?.duration_days ?? 30;
    const renewalRef = generateReference("REN");

    // Debit wallet atomically
    try {
      await admin.rpc("apply_wallet_ledger_entry", {
        p_user_id: user.id,
        p_entry_type: "debit",
        p_category: "renewal",
        p_amount_kobo: renewalAmountKobo,
        p_reference: renewalRef,
        p_description: `Renewal for ${service.service_label}`,
        p_order_id: service.order_id,
      });
    } catch (walletErr) {
      return NextResponse.json(
        { error: walletErr instanceof Error ? walletErr.message : "Insufficient wallet balance for renewal" },
        { status: 400 }
      );
    }

    const baseTime =
      service.expires_at && new Date(service.expires_at).getTime() > Date.now()
        ? new Date(service.expires_at).getTime()
        : Date.now();
    const nextExpiry = new Date(baseTime + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: renewal } = await admin
      .from("renewals")
      .insert({
        user_id: user.id,
        customer_service_id: service.id,
        order_id: service.order_id,
        amount_kobo: renewalAmountKobo,
        duration_days: durationDays,
        status: "processing",
        previous_expires_at: service.expires_at,
        new_expires_at: nextExpiry,
      })
      .select("*")
      .single();

    // Attempt automated supplier renewal if connected
    if (service.supplier && service.external_service_id && product?.delivery_method === "automated") {
      const ctx = buildSupplierContext(service.supplier as unknown as SupplierDbRow);
      const adapter = getSupplierAdapter(ctx.adapterKey);
      if (adapter.renew) {
        const result = await adapter.renew(ctx, {
          externalServiceId: service.external_service_id,
          durationDays,
          idempotencyKey: renewalRef,
        });

        if (result.status === "failed") {
          await admin.rpc("apply_wallet_ledger_entry", {
            p_user_id: user.id,
            p_entry_type: "credit",
            p_category: "refund",
            p_amount_kobo: renewalAmountKobo,
            p_reference: `REFUND-${renewalRef}`,
            p_description: `Automatic refund for failed renewal of ${service.service_label}`,
            p_order_id: service.order_id,
          });
          await admin
            .from("renewals")
            .update({ status: "refunded", error_message: result.errorMessage ?? "Supplier renewal failed" })
            .eq("id", renewal?.id);

          return NextResponse.json(
            { error: result.errorMessage || "Supplier renewal failed; wallet refunded." },
            { status: 502 }
          );
        }

        if (result.status === "delivered") {
          const finalExpiry = result.expiresAt ?? nextExpiry;
          await admin
            .from("customer_services")
            .update({ expires_at: finalExpiry, status: "active" })
            .eq("id", service.id);
          await admin
            .from("renewals")
            .update({ status: "completed", new_expires_at: finalExpiry })
            .eq("id", renewal?.id);

          await sendNotification({
            userId: user.id,
            type: "renewal_success",
            recipientEmail: user.email,
            subject: `Subscription Renewed - ${service.service_label}`,
            bodyText: `Your service ${service.service_label} has been renewed for ${formatNaira(renewalAmountKobo)}. New expiry: ${finalExpiry}.`,
            bodyHtml: `<p>Your service <strong>${service.service_label}</strong> has been renewed.</p><p>New expiry: ${new Date(finalExpiry).toUTCString()}</p>`,
          });

          return NextResponse.json({
            status: "completed",
            expiresAt: finalExpiry,
            message: "Service renewed successfully",
          });
        }
      }
    }

    // Otherwise queued for manual admin renewal completion
    return NextResponse.json({
      status: "processing",
      message: "Renewal payment received and queued for manual admin processing.",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Renewal failed" }, { status: 500 });
  }
}
