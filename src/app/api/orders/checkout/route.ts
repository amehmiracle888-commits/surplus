import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createBachsCheckoutSession } from "@/lib/bachs";
import { initializePaystackTransaction } from "@/lib/paystack";
import { processOrderFulfilment } from "@/lib/fulfilment";
import { sendNotification } from "@/lib/notifications";
import { writeAuditLog } from "@/lib/audit";
import { formatNaira, generateReference } from "@/lib/utils";
import type { ProductOptionSchema } from "@/types/database";

const CheckoutSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20).default(1),
  selectedOptions: z.record(z.string(), z.unknown()).default({}),
  paymentMethod: z.enum(["wallet", "bachs", "paystack"]),
  idempotencyKey: z.string().min(8).max(128).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireCustomer();
    const ip = getClientIp(request);
    const rl = checkRateLimit(`checkout:${user.id}:${ip}`, 12, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many checkout attempts. Please wait briefly." }, { status: 429 });
    }

    const body = await request.json();
    const parsed = CheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid checkout input", details: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createAdminClient();
    const idempotencyKey = parsed.data.idempotencyKey || generateReference("IDEMP");

    const { data: existingOrder } = await admin
      .from("orders")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingOrder) {
      return NextResponse.json({ order: existingOrder, idempotentReplay: true });
    }

    const { data: product, error: prodErr } = await admin
      .from("products")
      .select("*, category:product_categories(slug, name)")
      .eq("id", parsed.data.productId)
      .eq("is_active", true)
      .single();

    if (prodErr || !product) {
      return NextResponse.json({ error: "Selected product is unavailable" }, { status: 404 });
    }

    if (product.availability_status === "out_of_stock" || product.availability_status === "discontinued") {
      return NextResponse.json({ error: "This product is currently out of stock" }, { status: 400 });
    }

    if (product.stock_quantity !== null && product.stock_quantity < parsed.data.quantity) {
      return NextResponse.json({ error: `Only ${product.stock_quantity} unit(s) available` }, { status: 400 });
    }

    let optionDeltaKobo = 0;
    const optionsSchema = (product.options_schema ?? []) as ProductOptionSchema[];
    for (const opt of optionsSchema) {
      const selectedVal = parsed.data.selectedOptions[opt.key];
      if (opt.required && (selectedVal === undefined || selectedVal === "")) {
        return NextResponse.json({ error: `Please select ${opt.label}` }, { status: 400 });
      }
      if (opt.options && typeof selectedVal === "string") {
        const matched = opt.options.find((o) => o.value === selectedVal);
        if (matched?.price_delta_kobo) optionDeltaKobo += matched.price_delta_kobo;
      }
    }

    const unitPriceKobo = Math.max(0, Number(product.retail_price_kobo) + optionDeltaKobo);
    const subtotalKobo = unitPriceKobo * parsed.data.quantity;
    const wholesaleTotalKobo = Number(product.wholesale_cost_kobo ?? 0) * parsed.data.quantity;
    const orderReference = generateReference("ORD");
    const categorySlug = (product.category as { slug: string } | null)?.slug || "vpn";

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        order_reference: orderReference,
        user_id: user.id,
        status: "pending_payment",
        payment_status: "pending",
        payment_method: parsed.data.paymentMethod,
        subtotal_kobo: subtotalKobo,
        total_kobo: subtotalKobo,
        wholesale_cost_kobo: wholesaleTotalKobo,
        idempotency_key: idempotencyKey,
        customer_email: user.email,
        notes: parsed.data.notes ?? "",
      })
      .select("*")
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: orderErr?.message || "Failed to create order" }, { status: 500 });
    }

    await admin.from("order_items").insert({
      order_id: order.id,
      product_id: product.id,
      category_slug: categorySlug,
      product_name: product.name,
      provider: product.provider,
      quantity: parsed.data.quantity,
      unit_price_kobo: unitPriceKobo,
      unit_wholesale_cost_kobo: Number(product.wholesale_cost_kobo ?? 0),
      total_price_kobo: subtotalKobo,
      duration_days: product.duration_days,
      selected_options: parsed.data.selectedOptions,
    });

    if (parsed.data.paymentMethod === "wallet") {
      try {
        await admin.rpc("apply_wallet_ledger_entry", {
          p_user_id: user.id,
          p_entry_type: "debit",
          p_category: "purchase",
          p_amount_kobo: subtotalKobo,
          p_reference: `WALLET-ORD-${order.order_reference}`,
          p_description: `Order payment for ${product.name} (${order.order_reference})`,
          p_order_id: order.id,
          p_metadata: { order_reference: order.order_reference },
        });
      } catch (debitErr) {
        await admin.from("orders").update({ status: "cancelled", payment_status: "failed" }).eq("id", order.id);
        return NextResponse.json(
          { error: debitErr instanceof Error ? debitErr.message : "Insufficient wallet balance" },
          { status: 400 }
        );
      }

      await admin
        .from("orders")
        .update({
          payment_status: "paid",
          status: "paid",
          payment_reference: `WALLET-ORD-${order.order_reference}`,
          paid_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      await sendNotification({
        userId: user.id,
        type: "payment_success",
        recipientEmail: user.email,
        subject: `Payment Confirmed - ${order.order_reference}`,
        bodyText: `Wallet payment of ${formatNaira(subtotalKobo)} confirmed for ${product.name}.`,
        bodyHtml: `<p>Your wallet payment of <strong>${formatNaira(subtotalKobo)}</strong> for <strong>${product.name}</strong> has been confirmed.</p>`,
      });

      const fulfilment = await processOrderFulfilment(order.id);
      await writeAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "order.wallet_checkout",
        entityType: "order",
        entityId: order.id,
        afterState: { order_reference: order.order_reference, total_kobo: subtotalKobo, fulfilment },
      });

      return NextResponse.json({
        orderId: order.id,
        orderReference: order.order_reference,
        paymentMethod: "wallet",
        fulfilmentStatus: fulfilment.status,
        message: fulfilment.message,
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    if (parsed.data.paymentMethod === "bachs") {
      const bachsRef = generateReference("BCH");
      const session = await createBachsCheckoutSession({
        amountKobo: subtotalKobo,
        email: user.email,
        name: user.fullName || undefined,
        reference: bachsRef,
        successUrl: `${appUrl}/dashboard/orders?provider=bachs&reference=${encodeURIComponent(bachsRef)}`,
        cancelUrl: `${appUrl}/products/${product.slug}`,
        metadata: {
          order_id: order.id,
          order_reference: order.order_reference,
          purpose: "order_payment",
        },
      });

      await admin.from("payment_transactions").insert({
        user_id: user.id,
        order_id: order.id,
        purpose: "order_payment",
        provider: "bachs",
        reference: bachsRef,
        provider_reference: session.id,
        channel: "bachs_checkout",
        amount_kobo: subtotalKobo,
        currency: "NGN",
        status: "initialized",
        metadata: { order_reference: order.order_reference, product_id: product.id, checkout_id: session.id },
      });

      return NextResponse.json({
        orderId: order.id,
        orderReference: order.order_reference,
        paymentMethod: "bachs",
        checkout_url: session.checkout_url,
        reference: bachsRef,
      });
    }

    // Paystack checkout flow (optional fallback)
    const paystackRef = generateReference("PSK");
    await admin.from("payment_transactions").insert({
      user_id: user.id,
      order_id: order.id,
      purpose: "order_payment",
      provider: "paystack",
      reference: paystackRef,
      amount_kobo: subtotalKobo,
      currency: "NGN",
      status: "initialized",
      metadata: { order_reference: order.order_reference, product_id: product.id },
    });

    const paystack = await initializePaystackTransaction({
      email: user.email,
      amountKobo: subtotalKobo,
      reference: paystackRef,
      callbackUrl: `${appUrl}/dashboard/orders?provider=paystack&reference=${encodeURIComponent(paystackRef)}`,
      metadata: { order_id: order.id, order_reference: order.order_reference },
    });

    return NextResponse.json({
      orderId: order.id,
      orderReference: order.order_reference,
      paymentMethod: "paystack",
      authorization_url: paystack.authorization_url,
      reference: paystack.reference,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
