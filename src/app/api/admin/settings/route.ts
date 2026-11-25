import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";

const UpdateSettingSchema = z.object({
  key: z.string().min(2).max(60),
  value: z.unknown(),
  is_public: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data, error } = await admin.from("website_settings").select("*").order("key", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ settings: data ?? [] });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = await request.json();
    const parsed = UpdateSettingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid setting payload" }, { status: 400 });
    }

    const admin = createAdminClient();
    const isPublic = parsed.data.is_public ?? parsed.data.key !== "email_config";

    const { data, error } = await admin
      .from("website_settings")
      .upsert(
        {
          key: parsed.data.key,
          value: parsed.data.value,
          is_public: isPublic,
          updated_by: actor.id,
        },
        { onConflict: "key" }
      )
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "settings.update",
      entityType: "website_settings",
      entityId: parsed.data.key,
      afterState: { key: parsed.data.key },
    });

    return NextResponse.json({ setting: data });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to save setting" }, { status: 500 });
  }
}
