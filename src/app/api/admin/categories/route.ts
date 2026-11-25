import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";

const CategorySchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(80),
  description: z.string().max(300).default(""),
  icon: z.string().max(40).default("package"),
  sort_order: z.number().int().min(0).default(10),
  is_active: z.boolean().default(true),
});

export async function GET() {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("product_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ categories: data ?? [] });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = await request.json();
    const parsed = CategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid category payload", details: parsed.error.flatten() }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data: category, error } = await admin
      .from("product_categories")
      .insert({
        slug: parsed.data.slug,
        name: parsed.data.name,
        description: parsed.data.description,
        icon: parsed.data.icon,
        sort_order: parsed.data.sort_order,
        is_active: parsed.data.is_active,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "category.create",
      entityType: "product_category",
      entityId: category.id,
      afterState: category,
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Category id required" }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin.from("product_categories").delete().eq("id", id);
    if (error) {
      return NextResponse.json(
        { error: "Cannot delete a category that still has assigned products." },
        { status: 400 }
      );
    }

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "category.delete",
      entityType: "product_category",
      entityId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
