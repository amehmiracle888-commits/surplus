import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { setStatus, VirtualSmsError } from "@/lib/virtualsms";
import { writeAuditLog } from "@/lib/audit";
import { nairaToKobo } from "@/lib/utils";

const MIN_CANCEL_WAIT_MS = 5 * 60 * 1000; // 5 minutes

const CancelSchema = z.object({
  activationId: z.string().min(1).max(64),
});

const SAFE_ACTIVATION_COLUMNS =
  "id, user_id, activation_id, service_code, service_name, country_id, country_name, phone_number, retail_price, status, sms_code, sms_text, expires_at, created_at";

export async function POST(request: Request) {
  try {
    const user = await requireCustomer();
    const body = await request.json();
    const parsed = CancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid activationId" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("sms_activations")
      .select(SAFE_ACTIVATION_COLUMNS)
      .eq("user_id", user.id)
      .eq("activation_id", parsed.data.activationId)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json({ error: "Activation not found" }, { status: 404 });
    }

    if (row.status === "received") {
      return NextResponse.json(
        { error: "Cannot cancel an activation that already received an SMS code." },
        { status: 400 }
      );
    }

    if (row.status === "cancelled") {
      return NextResponse.json({ error: "This activation is already cancelled." }, { status: 400 });
    }

    const elapsedMs = Date.now() - new Date(row.created_at).getTime();
    if (elapsedMs < MIN_CANCEL_WAIT_MS) {
      const remainingSec = Math.ceil((MIN_CANCEL_WAIT_MS - elapsedMs) / 1000);
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      return NextResponse.json(
        {
          error: `Please wait ${mins}m ${String(secs).padStart(2, "0")}s before cancelling this number (5-minute minimum wait rule).`,
        },
        { status: 400 }
      );
    }

    try {
      await setStatus(row.activation_id, 8);
    } catch (providerErr) {
      if (providerErr instanceof VirtualSmsError) {
        return NextResponse.json(
          { error: providerErr.message },
          { status: providerErr.httpStatus }
        );
      }
      throw providerErr;
    }

    // Atomic conditional update prevents duplicate refunds
    const { data: claimedRows, error: updateErr } = await admin
      .from("sms_activations")
      .update({ status: "cancelled" })
      .eq("id", row.id)
      .in("status", ["pending", "expired"])
      .select(SAFE_ACTIVATION_COLUMNS);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    if (!claimedRows || claimedRows.length === 0) {
      return NextResponse.json({ error: "Activation was already finalized." }, { status: 409 });
    }

    const refundKobo = nairaToKobo(Number(row.retail_price));
    const { error: refundErr } = await admin.rpc("apply_wallet_ledger_entry", {
      p_user_id: user.id,
      p_entry_type: "credit",
      p_category: "refund",
      p_amount_kobo: refundKobo,
      p_reference: `SMS-CANCEL-REFUND-${row.activation_id}`,
      p_description: `Refund for cancelled VirtualSMS number: ${row.service_name} (${row.phone_number})`,
      p_metadata: { activation_id: row.activation_id },
    });

    if (refundErr) {
      console.error("[VirtualSMS cancel refund error]", refundErr);
      return NextResponse.json(
        { error: "Activation cancelled upstream, but wallet refund failed. Please contact support." },
        { status: 500 }
      );
    }

    await writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: "virtualsms.cancel_refund",
      entityType: "sms_activation",
      entityId: row.id,
      afterState: { activation_id: row.activation_id, refund_kobo: refundKobo },
    });

    return NextResponse.json({
      activation: claimedRows[0],
      refunded: true,
      retailPrice: Number(row.retail_price),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[VirtualSMS cancel error]", err);
    return NextResponse.json({ error: "Unable to cancel activation right now." }, { status: 500 });
  }
}
