import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";

export interface DefaultEmailEntry {
  id: string;
  label: string;
  address: string;
  purpose: "support" | "transactional" | "billing" | "general";
  is_active: boolean;
}

const EmailEntrySchema = z.object({
  id: z.string().min(1).max(80).optional(),
  label: z.string().min(2).max(80),
  address: z.string().email(),
  purpose: z.enum(["support", "transactional", "billing", "general"]).default("support"),
  is_active: z.boolean().default(true),
});

async function loadDefaultEmails(): Promise<DefaultEmailEntry[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("website_settings")
    .select("value")
    .eq("key", "default_emails")
    .maybeSingle();

  if (Array.isArray(data?.value)) {
    return data.value as DefaultEmailEntry[];
  }
  return [];
}

async function saveDefaultEmails(list: DefaultEmailEntry[], actorId: string) {
  const admin = createAdminClient();
  await admin.from("website_settings").upsert(
    {
      key: "default_emails",
      value: list,
      is_public: false,
      updated_by: actorId,
    },
    { onConflict: "key" }
  );
}

/**
 * Ensures deleted default addresses are no longer referenced by public contact or replyTo settings,
 * while preserving system-critical transactional provider/template configuration.
 */
async function purgeDeletedAddressReferences(deletedAddress: string, actorId: string) {
  const admin = createAdminClient();
  const normalized = deletedAddress.trim().toLowerCase();

  const { data: contactRow } = await admin
    .from("website_settings")
    .select("value")
    .eq("key", "contact")
    .maybeSingle();

  if (contactRow?.value && typeof contactRow.value === "object") {
    const contactVal = contactRow.value as Record<string, unknown>;
    if (String(contactVal.supportEmail || "").trim().toLowerCase() === normalized) {
      await admin
        .from("website_settings")
        .update({
          value: { ...contactVal, supportEmail: "" },
          updated_by: actorId,
        })
        .eq("key", "contact");
    }
  }

  const { data: emailCfgRow } = await admin
    .from("website_settings")
    .select("value")
    .eq("key", "email_config")
    .maybeSingle();

  if (emailCfgRow?.value && typeof emailCfgRow.value === "object") {
    const cfg = emailCfgRow.value as Record<string, unknown>;
    let changed = false;
    const nextCfg = { ...cfg };
    if (String(cfg.fromEmail || "").trim().toLowerCase() === normalized) {
      nextCfg.fromEmail = "";
      changed = true;
    }
    if (String(cfg.replyTo || "").trim().toLowerCase() === normalized) {
      nextCfg.replyTo = "";
      changed = true;
    }
    if (changed) {
      await admin
        .from("website_settings")
        .update({ value: nextCfg, updated_by: actorId })
        .eq("key", "email_config");
    }
  }
}

export async function GET() {
  try {
    await requireAdmin();
    const emails = await loadDefaultEmails();
    return NextResponse.json({ emails });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load default emails" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = await request.json();
    const parsed = EmailEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email address payload" }, { status: 400 });
    }

    const current = await loadDefaultEmails();
    const newEntry: DefaultEmailEntry = {
      id: parsed.data.id || `email-${Date.now()}`,
      label: parsed.data.label.trim(),
      address: parsed.data.address.trim(),
      purpose: parsed.data.purpose,
      is_active: parsed.data.is_active,
    };

    const next = [...current, newEntry];
    await saveDefaultEmails(next, actor.id);

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "default_emails.create",
      entityType: "website_settings",
      entityId: newEntry.id,
      afterState: newEntry as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ email: newEntry, emails: next }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to add default email" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = await request.json();
    const parsed = EmailEntrySchema.extend({ id: z.string().min(1) }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email update payload" }, { status: 400 });
    }

    const current = await loadDefaultEmails();
    const idx = current.findIndex((e) => e.id === parsed.data.id);
    if (idx === -1) {
      return NextResponse.json({ error: "Email address entry not found" }, { status: 404 });
    }

    const previous = current[idx];
    const updated: DefaultEmailEntry = {
      id: parsed.data.id,
      label: parsed.data.label.trim(),
      address: parsed.data.address.trim(),
      purpose: parsed.data.purpose,
      is_active: parsed.data.is_active,
    };

    const next = [...current];
    next[idx] = updated;
    await saveDefaultEmails(next, actor.id);

    if (previous.address.toLowerCase() !== updated.address.toLowerCase()) {
      await purgeDeletedAddressReferences(previous.address, actor.id);
    }

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "default_emails.update",
      entityType: "website_settings",
      entityId: updated.id,
      beforeState: previous as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ email: updated, emails: next });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to update default email" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Email id is required" }, { status: 400 });

    const current = await loadDefaultEmails();
    const target = current.find((e) => e.id === id);
    if (!target) {
      return NextResponse.json({ error: "Email address entry not found" }, { status: 404 });
    }

    const next = current.filter((e) => e.id !== id);
    await saveDefaultEmails(next, actor.id);
    await purgeDeletedAddressReferences(target.address, actor.id);

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "default_emails.delete",
      entityType: "website_settings",
      entityId: id,
      beforeState: target as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ ok: true, emails: next });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to delete default email" }, { status: 500 });
  }
}
