import { NextResponse } from "next/server";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSupplierContext, getSupplierAdapter, type SupplierDbRow } from "@/lib/suppliers/registry";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCustomer();
    const { id } = await context.params;
    const admin = createAdminClient();

    const { data: service } = await admin
      .from("customer_services")
      .select("*, supplier:suppliers(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!service) {
      return NextResponse.json({ error: "UK number service not found" }, { status: 404 });
    }

    const meta = (service.public_metadata ?? {}) as { sms_capable?: boolean };
    if (!meta.sms_capable) {
      return NextResponse.json({
        supported: false,
        messages: [],
        message: "This number does not support inbound SMS reception.",
      });
    }

    if (!service.supplier || !service.external_service_id) {
      return NextResponse.json({
        supported: false,
        messages: [],
        message: "Live SMS inbox API is not configured for this number's supplier.",
      });
    }

    const ctx = buildSupplierContext(service.supplier as unknown as SupplierDbRow);
    const adapter = getSupplierAdapter(ctx.adapterKey);
    if (!adapter.fetchInboundMessages) {
      return NextResponse.json({
        supported: false,
        messages: [],
        message: "Supplier adapter does not support inbound SMS polling.",
      });
    }

    const result = await adapter.fetchInboundMessages(ctx, service.external_service_id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to load inbound messages" }, { status: 500 });
  }
}
