import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { generateReference, nairaToKobo } from "@/lib/utils";

const CustomerActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("suspend"),
    reason: z.string().min(3).max(300),
  }),
  z.object({
    action: z.literal("restore"),
  }),
  z.object({
    action: z.literal("adjust_wallet"),
    entryType: z.enum(["credit", "debit"]),
    amountNaira: z.number().positive(),
    reason: z.string().min(3).max(300),
  }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = CustomerActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid customer action payload" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("*").eq("id", id).single();
    if (!profile) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    if (parsed.data.action === "suspend") {
      await admin
        .from("profiles")
        .update({
          is_suspended: true,
          suspended_reason: parsed.data.reason,
          suspended_at: new Date().toISOString(),
        })
        .eq("id", id);

      await writeAuditLog({
        actorId: actor.id,
        actorRole: actor.role,
        action: "customer.suspend",
        entityType: "profile",
        entityId: id,
        afterState: { is_suspended: true, reason: parsed.data.reason },
      });

      return NextResponse.json({ ok: true, is_suspended: true });
    }

    if (parsed.data.action === "restore") {
      await admin
        .from("profiles")
        .update({ is_suspended: false, suspended_reason: null, suspended_at: null })
        .eq("id", id);

      await writeAuditLog({
        actorId: actor.id,
        actorRole: actor.role,
        action: "customer.restore",
        entityType: "profile",
        entityId: id,
        afterState: { is_suspended: false },
      });

      return NextResponse.json({ ok: true, is_suspended: false });
    }

    // Audited wallet balance adjustment
    const amountKobo = nairaToKobo(parsed.data.amountNaira);
    const ref = generateReference("ADJ");
    const { data: tx, error } = await admin.rpc("apply_wallet_ledger_entry", {
      p_user_id: id,
      p_entry_type: parsed.data.entryType,
      p_category: "admin_adjustment",
      p_amount_kobo: amountKobo,
      p_reference: ref,
      p_description: parsed.data.reason,
      p_created_by: actor.id,
      p_metadata: { adjusted_by: actor.email },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "customer.wallet_adjust",
      entityType: "wallet",
      entityId: id,
      afterState: { entryType: parsed.data.entryType, amount_kobo: amountKobo, reference: ref, reason: parsed.data.reason },
    });

    return NextResponse.json({ ok: true, transaction: tx });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Customer action failed" }, { status: 500 });
  }
}
