import type {
  SupplierAdapter,
  SupplierConnectionTestResult,
  SupplierProvisionRequest,
  SupplierProvisionResult,
  SupplierRuntimeContext,
} from "@/lib/suppliers/types";

/**
 * Manual Fulfilment Adapter.
 * Used when a product or supplier is configured for administrator-controlled manual delivery
 * instead of an automated external API. Never fabricates credentials or delivery status.
 */
export class ManualFulfilmentAdapter implements SupplierAdapter {
  readonly key = "manual";
  readonly label = "Manual Fulfilment (Admin-Controlled)";

  async testConnection(_ctx: SupplierRuntimeContext): Promise<SupplierConnectionTestResult> {
    return {
      ok: true,
      latencyMs: 0,
      message: "Manual fulfilment workflow is active. Orders enter processing for admin delivery.",
    };
  }

  async provision(
    _ctx: SupplierRuntimeContext,
    _req: SupplierProvisionRequest
  ): Promise<SupplierProvisionResult> {
    return {
      status: "pending_manual",
      errorMessage: undefined,
      retryable: false,
    };
  }

  async renew(
    _ctx: SupplierRuntimeContext,
    _params: { externalServiceId: string; durationDays: number; idempotencyKey: string }
  ): Promise<SupplierProvisionResult> {
    return {
      status: "pending_manual",
      retryable: false,
    };
  }
}
