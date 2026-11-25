import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";
import { listRegisteredAdapters } from "@/lib/suppliers/registry";
import { maskSecret, nairaToKobo } from "@/lib/utils";

const SupplierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  adapter_key: z.string().min(2).max(60).default("custom_rest"),
  category_slug: z.string().min(2).max(60),
  api_base_url: z.string().max(300).default(""),
  auth_method: z.enum(["bearer", "api_key_header", "basic", "oauth2", "custom_header", "none"]).default("bearer"),
  api_key: z.string().optional(),
  api_secret: z.string().optional(),
  api_docs_url: z.string().max(300).default(""),
  is_active: z.boolean().default(true),
  priority: z.number().int().min(1).max(1000).default(10),
  config: z.record(z.string(), z.unknown()).default({}),
});

const SupplierProductMapSchema = z.object({
  action: z.literal("map_product"),
  supplier_id: z.string().uuid(),
  product_id: z.string().uuid(),
  external_product_id: z.string().min(1),
  external_plan_code: z.string().optional().default(""),
  wholesale_cost_naira: z.number().min(0).default(0),
  priority: z.number().int().min(1).default(10),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export async function GET() {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const [{ data: suppliers, error }, { data: mappings }] = await Promise.all([
      admin.from("suppliers").select("*").order("priority", { ascending: true }),
      admin
        .from("supplier_products")
        .select("*, product:products(id, name, slug), supplier:suppliers(id, name)")
        .order("priority", { ascending: true }),
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Never return encrypted/raw API keys to browser — return masked indicators only
    const safeSuppliers = (suppliers ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      adapter_key: s.adapter_key,
      category_slug: s.category_slug,
      api_base_url: s.api_base_url,
      auth_method: s.auth_method,
      has_api_key: Boolean(s.api_key_encrypted),
      has_api_secret: Boolean(s.api_secret_encrypted),
      api_key_masked: s.api_key_encrypted ? maskSecret("••••••••••••") : "",
      api_docs_url: s.api_docs_url,
      is_active: s.is_active,
      priority: s.priority,
      balance_amount: s.balance_amount,
      balance_currency: s.balance_currency,
      last_connected_at: s.last_connected_at,
      connection_status: s.connection_status,
      last_error: s.last_error,
      config: s.config ?? {},
      created_at: s.created_at,
    }));

    return NextResponse.json({
      suppliers: safeSuppliers,
      mappings: mappings ?? [],
      adapters: listRegisteredAdapters(),
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load suppliers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = await request.json();

    if (body?.action === "map_product") {
      const parsedMap = SupplierProductMapSchema.safeParse(body);
      if (!parsedMap.success) {
        return NextResponse.json({ error: "Invalid supplier product mapping" }, { status: 400 });
      }
      const m = parsedMap.data;
      const admin = createAdminClient();
      const { data: mapping, error } = await admin
        .from("supplier_products")
        .upsert(
          {
            supplier_id: m.supplier_id,
            product_id: m.product_id,
            external_product_id: m.external_product_id,
            external_plan_code: m.external_plan_code,
            wholesale_cost_kobo: nairaToKobo(m.wholesale_cost_naira),
            priority: m.priority,
            is_default: m.is_default,
            is_active: m.is_active,
          },
          { onConflict: "supplier_id,product_id" }
        )
        .select("*")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ mapping }, { status: 201 });
    }

    const parsed = SupplierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid supplier payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    const admin = createAdminClient();
    const { data: supplier, error } = await admin
      .from("suppliers")
      .insert({
        name: d.name,
        adapter_key: d.adapter_key,
        category_slug: d.category_slug,
        api_base_url: d.api_base_url,
        auth_method: d.auth_method,
        api_key_encrypted: d.api_key ? encryptSecret(d.api_key) : null,
        api_secret_encrypted: d.api_secret ? encryptSecret(d.api_secret) : null,
        api_docs_url: d.api_docs_url,
        is_active: d.is_active,
        priority: d.priority,
        config: d.config,
      })
      .select("id, name, adapter_key, category_slug, is_active, priority")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "supplier.create",
      entityType: "supplier",
      entityId: supplier.id,
      afterState: supplier,
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to save supplier" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = await request.json();
    const parsed = SupplierSchema.extend({ id: z.string().uuid() }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid supplier update" }, { status: 400 });
    }
    const d = parsed.data;
    const admin = createAdminClient();

    const updatePayload: Record<string, unknown> = {
      name: d.name,
      adapter_key: d.adapter_key,
      category_slug: d.category_slug,
      api_base_url: d.api_base_url,
      auth_method: d.auth_method,
      api_docs_url: d.api_docs_url,
      is_active: d.is_active,
      priority: d.priority,
      config: d.config,
    };

    if (d.api_key && d.api_key.trim().length > 0) {
      updatePayload.api_key_encrypted = encryptSecret(d.api_key.trim());
    }
    if (d.api_secret && d.api_secret.trim().length > 0) {
      updatePayload.api_secret_encrypted = encryptSecret(d.api_secret.trim());
    }

    const { data: updated, error } = await admin
      .from("suppliers")
      .update(updatePayload)
      .eq("id", d.id)
      .select("id, name, adapter_key, category_slug, is_active, priority")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "supplier.update",
      entityType: "supplier",
      entityId: d.id,
      afterState: updated,
    });

    return NextResponse.json({ supplier: updated });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Supplier id required" }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin.from("suppliers").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "supplier.delete",
      entityType: "supplier",
      entityId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to delete supplier" }, { status: 500 });
  }
}
