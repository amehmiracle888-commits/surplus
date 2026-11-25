import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSupplierContext, getSupplierAdapter, type SupplierDbRow } from "@/lib/suppliers/registry";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const admin = createAdminClient();

    const { data: supplier, error } = await admin.from("suppliers").select("*").eq("id", id).single();
    if (error || !supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const ctx = buildSupplierContext(supplier as unknown as SupplierDbRow);
    const adapter = getSupplierAdapter(ctx.adapterKey);
    const result = await adapter.testConnection(ctx);

    await admin
      .from("suppliers")
      .update({
        connection_status: result.ok ? "connected" : "failed",
        last_connected_at: result.ok ? new Date().toISOString() : supplier.last_connected_at,
        last_error: result.ok ? null : result.message,
        balance_amount: result.balanceAmount ?? supplier.balance_amount,
      })
      .eq("id", id);

    await admin.from("supplier_transactions").insert({
      supplier_id: id,
      operation: "test_connection",
      http_status: result.httpStatus ?? null,
      status: result.ok ? "success" : "failed",
      error_message: result.ok ? null : result.message,
      duration_ms: result.latencyMs,
      response_payload: (result.raw ?? {}) as Record<string, unknown>,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Connection test failed" }, { status: 500 });
  }
}
