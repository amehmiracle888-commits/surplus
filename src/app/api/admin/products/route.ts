import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { nairaToKobo } from "@/lib/utils";

const ProductPayloadSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  slug: z.string().min(2).max(120),
  name: z.string().min(2).max(160),
  provider: z.string().max(120).default(""),
  short_description: z.string().max(300).default(""),
  description: z.string().default(""),
  image_url: z.string().optional().nullable(),
  terms_and_conditions: z.string().default(""),
  setup_instructions: z.string().default(""),
  billing_cycle: z.enum(["once", "weekly", "monthly", "quarterly", "biannual", "annual", "custom"]).default("monthly"),
  duration_days: z.number().int().min(1).default(30),
  retail_price_naira: z.number().min(0),
  wholesale_cost_naira: z.number().min(0).default(0),
  renewal_price_naira: z.number().min(0).optional().nullable(),
  delivery_method: z.enum(["automated", "manual"]).default("manual"),
  availability_status: z.enum(["in_stock", "low_stock", "out_of_stock", "discontinued"]).default("in_stock"),
  stock_quantity: z.number().int().min(0).optional().nullable(),
  default_supplier_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  is_popular: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
  options_schema: z.array(z.unknown()).default([]),
});

export async function GET() {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const [{ data: products, error }, { data: categories }] = await Promise.all([
      admin
        .from("products")
        .select("*, category:product_categories(id, slug, name)")
        .order("created_at", { ascending: false }),
      admin.from("product_categories").select("*").order("sort_order", { ascending: true }),
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ products: products ?? [], categories: categories ?? [] });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = await request.json();
    const parsed = ProductPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid product data", details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    const admin = createAdminClient();

    const row = {
      category_id: d.category_id,
      slug: d.slug,
      name: d.name,
      provider: d.provider,
      short_description: d.short_description,
      description: d.description,
      image_url: d.image_url ?? "",
      terms_and_conditions: d.terms_and_conditions,
      setup_instructions: d.setup_instructions,
      billing_cycle: d.billing_cycle,
      duration_days: d.duration_days,
      retail_price_kobo: nairaToKobo(d.retail_price_naira),
      wholesale_cost_kobo: nairaToKobo(d.wholesale_cost_naira),
      renewal_price_kobo: d.renewal_price_naira != null ? nairaToKobo(d.renewal_price_naira) : null,
      delivery_method: d.delivery_method,
      availability_status: d.availability_status,
      stock_quantity: d.stock_quantity ?? null,
      default_supplier_id: d.default_supplier_id ?? null,
      is_active: d.is_active,
      is_featured: d.is_featured,
      is_popular: d.is_popular,
      metadata: { ...d.metadata, device_limit: 1 },
      options_schema: d.options_schema,
    };

    const { data: product, error } = await admin.from("products").insert(row).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "product.create",
      entityType: "product",
      entityId: product.id,
      afterState: product,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = await request.json();
    const parsed = ProductPayloadSchema.extend({ id: z.string().uuid() }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid update payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    const admin = createAdminClient();

    const { data: existing } = await admin.from("products").select("*").eq("id", d.id).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const updateRow = {
      category_id: d.category_id,
      slug: d.slug,
      name: d.name,
      provider: d.provider,
      short_description: d.short_description,
      description: d.description,
      image_url: d.image_url ?? "",
      terms_and_conditions: d.terms_and_conditions,
      setup_instructions: d.setup_instructions,
      billing_cycle: d.billing_cycle,
      duration_days: d.duration_days,
      retail_price_kobo: nairaToKobo(d.retail_price_naira),
      wholesale_cost_kobo: nairaToKobo(d.wholesale_cost_naira),
      renewal_price_kobo: d.renewal_price_naira != null ? nairaToKobo(d.renewal_price_naira) : null,
      delivery_method: d.delivery_method,
      availability_status: d.availability_status,
      stock_quantity: d.stock_quantity ?? null,
      default_supplier_id: d.default_supplier_id ?? null,
      is_active: d.is_active,
      is_featured: d.is_featured,
      is_popular: d.is_popular,
      metadata: { ...d.metadata, device_limit: 1 },
      options_schema: d.options_schema,
    };

    const { data: updated, error } = await admin
      .from("products")
      .update(updateRow)
      .eq("id", d.id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "product.update",
      entityType: "product",
      entityId: d.id,
      beforeState: existing,
      afterState: updated,
    });

    return NextResponse.json({ product: updated });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Product id is required" }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin.from("products").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "product.delete",
      entityType: "product",
      entityId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
