import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { retrieveBachsCheckoutSession } from "@/lib/bachs";
import { processOrderFulfilment } from "@/lib/fulfilment";
import { sendNotification } from "@/lib/notifications";
import { writeAuditLog } from "@/lib/audit";
import { formatNaira, nairaToKobo } from "@/lib/utils";

async function finalizeSuccessfulPayment(params: {
  paymentTx: Record<string, unknown>;
  providerReference: string;
  channel: string;
  feeKobo: number;
  rawVerification: Record<string, unknown>;
}): Promise<{
  settled: boolean;
  purpose: string;
  orderId?: string | null;
  status: string;
  message: string;
}> {
  const admin = createAdminClient();
  const txId = String(params.paymentTx.id);
  const userId = String(params.paymentTx.user_id);
  const purpose = String(params.paymentTx.purpose);
  const reference = String(params.paymentTx.reference);
  const amountKobo = Number(params.paymentTx.amount_kobo);
  const orderId = params.paymentTx.order_id ? String(params.paymentTx.order_id) : null;
  const provider = String(params.paymentTx.provider || "bachs");

  // Atomic conditional update prevents double crediting or duplicate order fulfilment
  const { data: claimedRows, error: claimErr } = await admin
    .from("payment_transactions")
    .update({
      status: "success",
      provider_reference: params.providerReference,
      channel: params.channel,
      fee_kobo: params.feeKobo,
      verified_at: new Date().toISOString(),
      raw_verification: params.rawVerification,
    })
    .eq("id", txId)
    .neq("status", "success")
    .select("*");

  if (claimErr) throw new Error(claimErr.message);

  if (!claimedRows || claimedRows.length === 0) {
    return {
      settled: true,
      purpose,
      orderId,
      status: "success",
      message: "Payment already verified and settled",
    };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (purpose === "wallet_deposit") {
    await admin.rpc("apply_wallet_ledger_entry", {
      p_user_id: userId,
      p_entry_type: "credit",
      p_category: "deposit",
      p_amount_kobo: amountKobo,
      p_reference: `${provider.toUpperCase()}-DEP-${reference}`,
      p_description: `${provider === "bachs" ? "Bachs.io" : "Paystack"} wallet deposit (${params.channel})`,
      p_payment_transaction_id: txId,
      p_metadata: { provider_reference: params.providerReference, channel: params.channel },
    });

    await sendNotification({
      userId,
      type: "wallet_deposit",
      recipientEmail: profile?.email,
      subject: `Wallet Credited - ${formatNaira(amountKobo)}`,
      bodyText: `Your wallet has been credited with ${formatNaira(amountKobo)} (Ref: ${reference}).`,
      bodyHtml: `<p>Your wallet deposit of <strong>${formatNaira(amountKobo)}</strong> has been confirmed.</p><p>Reference: <code>${reference}</code></p>`,
    });

    return {
      settled: true,
      purpose: "wallet_deposit",
      status: "success",
      message: "Wallet credited successfully",
    };
  }

  if (purpose === "order_payment" && orderId) {
    await admin
      .from("orders")
      .update({
        payment_status: "paid",
        status: "paid",
        payment_reference: reference,
        paid_at: new Date().toISOString(),
        processing_fee_kobo: params.feeKobo,
      })
      .eq("id", orderId)
      .neq("payment_status", "paid");

    await sendNotification({
      userId,
      type: "payment_success",
      recipientEmail: profile?.email,
      subject: `Payment Confirmed - ${reference}`,
      bodyText: `We confirmed your payment of ${formatNaira(amountKobo)}. Your order is now being processed.`,
      bodyHtml: `<p>We confirmed your payment of <strong>${formatNaira(amountKobo)}</strong>.</p><p>Your order is now being provisioned.</p>`,
    });

    await processOrderFulfilment(orderId);

    return {
      settled: true,
      purpose: "order_payment",
      orderId,
      status: "success",
      message: "Order paid and submitted for fulfilment",
    };
  }

  return {
    settled: true,
    purpose,
    orderId,
    status: "success",
    message: "Payment verified",
  };
}

/**
 * Verifies a Bachs.io Checkout Session against Bachs' API and atomically settles the transaction.
 */
export async function settleBachsPayment(
  referenceOrCheckoutId: string,
  source: "callback" | "webhook"
) {
  const admin = createAdminClient();

  const { data: paymentTx, error: txErr } = await admin
    .from("payment_transactions")
    .select("*")
    .or(`reference.eq.${referenceOrCheckoutId},provider_reference.eq.${referenceOrCheckoutId}`)
    .maybeSingle();

  if (txErr || !paymentTx) {
    throw new Error("Bachs payment transaction record not found");
  }

  if (source === "webhook") {
    await admin
      .from("payment_transactions")
      .update({ webhook_received_at: new Date().toISOString() })
      .eq("id", paymentTx.id);
  }

  const checkoutId = paymentTx.provider_reference || referenceOrCheckoutId;
  const session = await retrieveBachsCheckoutSession(checkoutId);

  const isPaid = session.payment_status === "paid" || session.status === "complete";
  if (!isPaid) {
    await admin
      .from("payment_transactions")
      .update({
        status: session.status === "expired" ? "abandoned" : "pending",
        raw_verification: session as unknown as Record<string, unknown>,
      })
      .eq("id", paymentTx.id)
      .neq("status", "success");

    return {
      settled: false,
      purpose: paymentTx.purpose,
      orderId: paymentTx.order_id,
      status: session.payment_status || session.status,
      message: `Bachs checkout status is ${session.payment_status || session.status}`,
    };
  }

  const verifiedAmountKobo =
    session.amount_total !== undefined ? nairaToKobo(Number(session.amount_total)) : Number(paymentTx.amount_kobo);

  if (
    (session.currency && session.currency.toUpperCase() !== "NGN") ||
    verifiedAmountKobo !== Number(paymentTx.amount_kobo)
  ) {
    await writeAuditLog({
      actorId: paymentTx.user_id,
      actorRole: "system",
      action: "payment.bachs_amount_mismatch",
      entityType: "payment_transaction",
      entityId: paymentTx.id,
      metadata: {
        expected_kobo: paymentTx.amount_kobo,
        received_kobo: verifiedAmountKobo,
        currency: session.currency,
      },
    });
    throw new Error("Bachs payment verification mismatch (amount or currency)");
  }

  return finalizeSuccessfulPayment({
    paymentTx,
    providerReference: session.id,
    channel: "bachs_checkout",
    feeKobo: 0,
    rawVerification: session as unknown as Record<string, unknown>,
  });
}

/**
 * Verifies a Paystack transaction against Paystack's API and atomically settles it.
 */
export async function settlePaystackPayment(reference: string, source: "callback" | "webhook") {
  const admin = createAdminClient();

  const { data: paymentTx, error: txErr } = await admin
    .from("payment_transactions")
    .select("*")
    .eq("reference", reference)
    .single();

  if (txErr || !paymentTx) {
    throw new Error("Payment transaction record not found");
  }

  const verified = await verifyPaystackTransaction(reference);

  if (source === "webhook") {
    await admin
      .from("payment_transactions")
      .update({ webhook_received_at: new Date().toISOString() })
      .eq("id", paymentTx.id);
  }

  if (verified.status !== "success") {
    await admin
      .from("payment_transactions")
      .update({
        status: verified.status === "abandoned" ? "abandoned" : "failed",
        raw_verification: verified as unknown as Record<string, unknown>,
      })
      .eq("id", paymentTx.id)
      .neq("status", "success");

    return {
      settled: false,
      purpose: paymentTx.purpose,
      orderId: paymentTx.order_id,
      status: verified.status,
      message: `Paystack status is ${verified.status}`,
    };
  }

  if (verified.currency !== "NGN" || Number(verified.amount) !== Number(paymentTx.amount_kobo)) {
    await writeAuditLog({
      actorId: paymentTx.user_id,
      actorRole: "system",
      action: "payment.amount_mismatch",
      entityType: "payment_transaction",
      entityId: paymentTx.id,
      metadata: {
        expected_kobo: paymentTx.amount_kobo,
        received_kobo: verified.amount,
        currency: verified.currency,
      },
    });
    throw new Error("Payment verification mismatch (amount or currency)");
  }

  return finalizeSuccessfulPayment({
    paymentTx,
    providerReference: String(verified.id),
    channel: verified.channel || "card",
    feeKobo: Number(verified.fees ?? 0),
    rawVerification: verified as unknown as Record<string, unknown>,
  });
}
