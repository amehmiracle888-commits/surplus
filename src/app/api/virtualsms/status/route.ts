import { NextResponse } from "next/server";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStatusV2, setStatus, VirtualSmsError } from "@/lib/virtualsms";
import { nairaToKobo } from "@/lib/utils";

const SAFE_ACTIVATION_COLUMNS =
  "id, user_id, activation_id, service_code, service_name, country_id, country_name, phone_number, retail_price, status, sms_code, sms_text, expires_at, created_at";

export async function GET(request: Request) {
  try {
    const user = await requireCustomer();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json({ error: "Missing activation id" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("sms_activations")
      .select(SAFE_ACTIVATION_COLUMNS)
      .eq("user_id", user.id)
      .eq("activation_id", id)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json({ error: "Activation not found" }, { status: 404 });
    }

    if (row.status === "received" || row.status === "cancelled" || row.status === "expired") {
      return NextResponse.json({ activation: row });
    }

    // Check upstream status
    let upstream;
    try {
      upstream = await getStatusV2(row.activation_id);
    } catch (err) {
      if (err instanceof VirtualSmsError) {
        return NextResponse.json({ error: err.message, activation: row }, { status: err.httpStatus });
      }
      throw err;
    }

    if (upstream.status === "received") {
      const { data: updated } = await admin
        .from("sms_activations")
        .update({
          status: "received",
          sms_code: upstream.code,
          sms_text: upstream.text,
        })
        .eq("id", row.id)
        .select(SAFE_ACTIVATION_COLUMNS)
        .single();

      // Best-effort confirm completion on VirtualSMS
      await setStatus(row.activation_id, 6).catch(() => null);

      return NextResponse.json({ activation: updated ?? row });
    }

    if (upstream.status === "cancelled") {
      const { data: claimed } = await admin
        .from("sms_activations")
        .update({ status: "cancelled" })
        .eq("id", row.id)
        .eq("status", "pending")
        .select(SAFE_ACTIVATION_COLUMNS);

      if (claimed && claimed.length > 0) {
        await admin.rpc("apply_wallet_ledger_entry", {
          p_user_id: user.id,
          p_entry_type: "credit",
          p_category: "refund",
          p_amount_kobo: nairaToKobo(Number(row.retail_price)),
          p_reference: `SMS-UPSTREAM-REFUND-${row.activation_id}`,
          p_description: `Refund for cancelled VirtualSMS activation (${row.service_name})`,
          p_metadata: { activation_id: row.activation_id },
        });
        return NextResponse.json({ activation: claimed[0] });
      }
    }

    // Expire locally if 20-minute window has elapsed with no SMS received
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      const { data: expiredRow } = await admin
        .from("sms_activations")
        .update({ status: "expired" })
        .eq("id", row.id)
        .eq("status", "pending")
        .select(SAFE_ACTIVATION_COLUMNS)
        .maybeSingle();

      return NextResponse.json({ activation: expiredRow ?? row });
    }

    return NextResponse.json({ activation: row });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[VirtualSMS status error]", err);
    return NextResponse.json({ error: "Failed to check activation status" }, { status: 500 });
  }
}
