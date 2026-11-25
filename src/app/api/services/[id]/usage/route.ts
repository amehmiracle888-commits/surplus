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
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    if (!service.supplier || !service.external_service_id) {
      return NextResponse.json({
        supported: false,
        message: "Live bandwidth usage API is not connected for this service.",
      });
    }

    const ctx = buildSupplierContext(service.supplier as unknown as SupplierDbRow);
    const adapter = getSupplierAdapter(ctx.adapterKey);
    if (!adapter.checkUsage) {
      return NextResponse.json({
        supported: false,
        message: "This supplier adapter does not expose bandwidth telemetry.",
      });
    }

    const usage = await adapter.checkUsage(ctx, service.external_service_id);
    if (usage.ok) {
      await admin
        .from("customer_services")
        .update({
          last_usage_synced_at: new Date().toISOString(),
          public_metadata: {
            ...(service.public_metadata ?? {}),
            bandwidth_total_mb: usage.bandwidthTotalMb,
            bandwidth_used_mb: usage.bandwidthUsedMb,
            bandwidth_remaining_mb: usage.bandwidthRemainingMb,
          },
        })
        .eq("id", service.id);
    }

    return NextResponse.json(usage);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to check proxy usage" }, { status: 500 });
  }
}
