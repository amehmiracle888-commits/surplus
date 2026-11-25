import { createAdminClient } from "@/lib/supabase/admin";
import { encryptJsonSecret } from "@/lib/crypto";
import { sendNotification } from "@/lib/notifications";
import { writeAuditLog } from "@/lib/audit";
import { buildSupplierContext, getSupplierAdapter, type SupplierDbRow } from "@/lib/suppliers/registry";
import { formatNaira, generateReference } from "@/lib/utils";

/**
 * Processes an already-paid order through automated supplier provisioning (or manual fallback).
 * Enforces idempotency at the order_fulfilments level and never marks failed API calls as delivered.
 */
export async function processOrderFulfilment(orderId: string): Promise<{
  status: "delivered" | "processing" | "failed";
  message: string;
}> {
  const admin = createAdminClient();

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    throw new Error("Order not found");
  }

  if (order.payment_status !== "paid") {
    throw new Error("Cannot fulfil an unpaid order");
  }

  if (order.status === "delivered") {
    return { status: "delivered", message: "Order already delivered" };
  }

  await admin.from("orders").update({ status: "processing" }).eq("id", orderId);

  const { data: items } = await admin.from("order_items").select("*").eq("order_id", orderId);
  if (!items || items.length === 0) {
    throw new Error("Order has no items");
  }

  let allDelivered = true;
  let anyFailed = false;
  let anyPendingManual = false;

  for (const item of items) {
    const itemIdempotency = `FULFILL-${order.id}-${item.id}`;

    // Check existing fulfilment record for idempotency
    const { data: existingFulfilment } = await admin
      .from("order_fulfilments")
      .select("*")
      .eq("idempotency_key", itemIdempotency)
      .maybeSingle();

    if (existingFulfilment?.status === "delivered") {
      continue;
    }

    const { data: product } = await admin
      .from("products")
      .select("*")
      .eq("id", item.product_id)
      .single();

    if (!product) {
      anyFailed = true;
      continue;
    }

    // Resolve eligible suppliers in priority order ONLY when mapped & compatible
    const candidateSuppliers: { supplier: SupplierDbRow; externalProductId: string; externalPlanCode?: string }[] = [];

    const { data: mappedSuppliers } = await admin
      .from("supplier_products")
      .select("*, supplier:suppliers(*)")
      .eq("product_id", product.id)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("priority", { ascending: true });

    for (const map of mappedSuppliers ?? []) {
      const sup = map.supplier as unknown as SupplierDbRow & { is_active: boolean };
      if (sup && sup.is_active) {
        candidateSuppliers.push({
          supplier: sup,
          externalProductId: map.external_product_id,
          externalPlanCode: map.external_plan_code || undefined,
        });
      }
    }

    // If product delivery_method is manual or no active automated supplier is mapped, enter manual queue
    if (product.delivery_method === "manual" || candidateSuppliers.length === 0) {
      const fulfilmentPayload = {
        order_id: order.id,
        order_item_id: item.id,
        supplier_id: product.default_supplier_id ?? null,
        fulfilment_mode: "manual" as const,
        status: "processing" as const,
        idempotency_key: itemIdempotency,
        attempt_count: (existingFulfilment?.attempt_count ?? 0) + 1,
      };

      if (existingFulfilment) {
        await admin.from("order_fulfilments").update(fulfilmentPayload).eq("id", existingFulfilment.id);
      } else {
        await admin.from("order_fulfilments").insert(fulfilmentPayload);
      }
      anyPendingManual = true;
      allDelivered = false;
      continue;
    }

    // Attempt automated supplier provisioning across compatible candidates
    let deliveredForItem = false;
    let lastError = "Supplier provisioning failed";
    let shouldRetry = false;

    for (const candidate of candidateSuppliers) {
      const ctx = buildSupplierContext(candidate.supplier);
      const adapter = getSupplierAdapter(ctx.adapterKey);
      const started = Date.now();
      const supTxKey = `SUPTX-${itemIdempotency}-${candidate.supplier.id}-${(existingFulfilment?.attempt_count ?? 0) + 1}`;

      const result = await adapter.provision(ctx, {
        orderId: order.id,
        orderReference: order.order_reference,
        orderItemId: item.id,
        idempotencyKey: itemIdempotency,
        categorySlug: item.category_slug,
        externalProductId: candidate.externalProductId,
        externalPlanCode: candidate.externalPlanCode,
        quantity: item.quantity,
        durationDays: item.duration_days,
        selectedOptions: (item.selected_options ?? {}) as Record<string, unknown>,
        customerEmail: order.customer_email,
      });

      const durationMs = Date.now() - started;

      await admin.from("supplier_transactions").insert({
        supplier_id: candidate.supplier.id,
        order_id: order.id,
        order_fulfilment_id: existingFulfilment?.id ?? null,
        operation: "create_order",
        idempotency_key: supTxKey,
        request_payload: {
          external_product_id: candidate.externalProductId,
          quantity: item.quantity,
          duration_days: item.durationDays,
        },
        response_payload: result.rawResponse ?? {},
        http_status: result.httpStatus ?? null,
        status: result.status === "delivered" ? "success" : "failed",
        error_message: result.errorMessage ?? null,
        duration_ms: durationMs,
      });

      if (result.status === "pending_manual") {
        anyPendingManual = true;
        allDelivered = false;
        deliveredForItem = false;
        break;
      }

      if (result.status === "delivered") {
        const expiresAt =
          result.expiresAt ??
          new Date(Date.now() + item.duration_days * 24 * 60 * 60 * 1000).toISOString();

        const fulfilmentData = {
          order_id: order.id,
          order_item_id: item.id,
          supplier_id: candidate.supplier.id,
          fulfilment_mode: "automated" as const,
          status: "delivered" as const,
          attempt_count: (existingFulfilment?.attempt_count ?? 0) + 1,
          external_reference: result.externalReference ?? null,
          supplier_response: result.rawResponse ?? {},
          error_message: null,
          idempotency_key: itemIdempotency,
        };

        if (existingFulfilment) {
          await admin.from("order_fulfilments").update(fulfilmentData).eq("id", existingFulfilment.id);
        } else {
          await admin.from("order_fulfilments").insert(fulfilmentData);
        }

        await admin.from("customer_services").insert({
          user_id: order.user_id,
          order_id: order.id,
          order_item_id: item.id,
          product_id: item.product_id,
          supplier_id: candidate.supplier.id,
          category_slug: item.category_slug,
          service_label: item.product_name,
          provider: item.provider,
          status: "active",
          credentials_encrypted: encryptJsonSecret(result.credentials ?? {}),
          public_metadata: {
            ...(product.metadata ?? {}),
            ...(result.publicMetadata ?? {}),
            setup_instructions: product.setup_instructions,
          },
          external_service_id: result.externalReference ?? null,
          starts_at: new Date().toISOString(),
          expires_at: expiresAt,
          renewal_price_kobo: product.renewal_price_kobo ?? product.retail_price_kobo,
        });

        deliveredForItem = true;
        break;
      }

      lastError = result.errorMessage || "Supplier returned failure";
      shouldRetry = Boolean(result.retryable);
    }

    if (!deliveredForItem && !anyPendingManual) {
      allDelivered = false;
      anyFailed = true;

      const nextAttempts = (existingFulfilment?.attempt_count ?? 0) + 1;
      const retryStatus = shouldRetry && nextAttempts < 3 ? "retrying" : "failed";
      const nextRetryAt =
        retryStatus === "retrying" ? new Date(Date.now() + nextAttempts * 5 * 60 * 1000).toISOString() : null;

      const failedData = {
        order_id: order.id,
        order_item_id: item.id,
        supplier_id: candidateSuppliers[0]?.supplier.id ?? null,
        fulfilment_mode: "automated" as const,
        status: retryStatus as "retrying" | "failed",
        attempt_count: nextAttempts,
        next_retry_at: nextRetryAt,
        error_message: lastError,
        idempotency_key: itemIdempotency,
      };

      if (existingFulfilment) {
        await admin.from("order_fulfilments").update(failedData).eq("id", existingFulfilment.id);
      } else {
        await admin.from("order_fulfilments").insert(failedData);
      }
    }
  }

  if (allDelivered) {
    await admin
      .from("orders")
      .update({ status: "delivered", fulfilled_at: new Date().toISOString() })
      .eq("id", orderId);

    await sendNotification({
      userId: order.user_id,
      type: "delivery_success",
      recipientEmail: order.customer_email,
      subject: `Your Digital Service is Ready - ${order.order_reference}`,
      bodyText: `Your order ${order.order_reference} has been delivered. Log in to your dashboard to access your credentials and setup guide.`,
      bodyHtml: `<p>Your order <strong>${order.order_reference}</strong> has been delivered.</p><p>Sign in to your Customer Dashboard to view your service credentials and setup instructions.</p>`,
      metadata: { orderId: order.id, orderReference: order.order_reference },
    });

    return { status: "delivered", message: "Order provisioned and delivered" };
  }

  if (anyFailed && !anyPendingManual) {
    await admin.from("orders").update({ status: "failed" }).eq("id", orderId);

    // Issue automatic wallet refund credit for confirmed non-retryable failures
    const { data: stillRetrying } = await admin
      .from("order_fulfilments")
      .select("id")
      .eq("order_id", orderId)
      .eq("status", "retrying");

    if (!stillRetrying || stillRetrying.length === 0) {
      await refundOrderToWallet(orderId, "Automatic refund after confirmed supplier fulfilment failure");
    }

    await sendNotification({
      userId: order.user_id,
      type: "delivery_failed",
      recipientEmail: order.customer_email,
      subject: `Order Fulfilment Update - ${order.order_reference}`,
      bodyText: `We could not complete automated provisioning for order ${order.order_reference}. Your payment has been queued for review or credited back to your wallet.`,
      bodyHtml: `<p>We could not complete automated provisioning for order <strong>${order.order_reference}</strong>.</p><p>Any confirmed fulfilment failure is automatically credited back to your wallet.</p>`,
      metadata: { orderId: order.id },
    });

    return { status: "failed", message: "Supplier provisioning failed" };
  }

  return { status: "processing", message: "Order queued for manual admin fulfilment" };
}

export async function refundOrderToWallet(
  orderId: string,
  reason: string,
  adminActorId?: string
): Promise<void> {
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single();
  if (!order) throw new Error("Order not found");
  if (order.status === "refunded" || order.payment_status === "refunded") return;
  if (order.payment_status !== "paid") throw new Error("Only paid orders can be refunded");

  const refundRef = `REFUND-${order.order_reference}`;
  await admin.rpc("apply_wallet_ledger_entry", {
    p_user_id: order.user_id,
    p_entry_type: "credit",
    p_category: "refund",
    p_amount_kobo: order.total_kobo,
    p_reference: refundRef,
    p_description: `${reason} (${order.order_reference})`,
    p_order_id: order.id,
    p_created_by: adminActorId ?? null,
    p_metadata: { order_reference: order.order_reference, reason },
  });

  await admin
    .from("orders")
    .update({ status: "refunded", payment_status: "refunded" })
    .eq("id", order.id);

  await writeAuditLog({
    actorId: adminActorId ?? null,
    actorRole: adminActorId ? "admin" : "system",
    action: "order.refund_to_wallet",
    entityType: "order",
    entityId: order.id,
    afterState: { status: "refunded", amount_kobo: order.total_kobo, reason },
  });

  await sendNotification({
    userId: order.user_id,
    type: "wallet_deposit",
    recipientEmail: order.customer_email,
    subject: `Wallet Refund Credited - ${formatNaira(order.total_kobo)}`,
    bodyText: `${formatNaira(order.total_kobo)} has been credited to your wallet for order ${order.order_reference}. Reason: ${reason}.`,
    bodyHtml: `<p><strong>${formatNaira(order.total_kobo)}</strong> has been credited to your wallet for order <strong>${order.order_reference}</strong>.</p><p>Reason: ${reason}</p>`,
  });
}

export function buildManualServiceRef(): string {
  return generateReference("SRV");
}
