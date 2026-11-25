export type SupplierAuthMethod =
  | "bearer"
  | "api_key_header"
  | "basic"
  | "oauth2"
  | "custom_header"
  | "none";

export interface SupplierEndpointConfig {
  headerName?: string;
  testEndpoint?: string;
  balanceEndpoint?: string;
  balanceJsonPath?: string;
  productsEndpoint?: string;
  availabilityEndpoint?: string;
  provisionEndpoint?: string;
  retrieveEndpoint?: string;
  renewEndpoint?: string;
  suspendEndpoint?: string;
  usageEndpoint?: string;
  topUpEndpoint?: string;
  messagesEndpoint?: string;
  extraHeaders?: Record<string, string>;
}

export interface SupplierRuntimeContext {
  supplierId: string;
  supplierName: string;
  adapterKey: string;
  categorySlug: string;
  apiBaseUrl: string;
  authMethod: SupplierAuthMethod;
  apiKey: string;
  apiSecret: string;
  config: SupplierEndpointConfig;
}

export interface SupplierConnectionTestResult {
  ok: boolean;
  httpStatus?: number;
  latencyMs: number;
  message: string;
  balanceAmount?: number;
  balanceCurrency?: string;
  raw?: unknown;
}

export interface SupplierProvisionRequest {
  orderId: string;
  orderReference: string;
  orderItemId: string;
  idempotencyKey: string;
  categorySlug: string;
  externalProductId: string;
  externalPlanCode?: string;
  quantity: number;
  durationDays: number;
  selectedOptions: Record<string, unknown>;
  customerEmail: string;
}

export interface SupplierProvisionResult {
  status: "delivered" | "pending_manual" | "failed";
  externalReference?: string;
  credentials?: Record<string, unknown>;
  publicMetadata?: Record<string, unknown>;
  expiresAt?: string;
  httpStatus?: number;
  rawResponse?: Record<string, unknown>;
  errorMessage?: string;
  retryable?: boolean;
}

export interface SupplierUsageResult {
  ok: boolean;
  supported: boolean;
  bandwidthTotalMb?: number;
  bandwidthUsedMb?: number;
  bandwidthRemainingMb?: number;
  raw?: Record<string, unknown>;
  errorMessage?: string;
}

export interface SupplierMessageRecord {
  id: string;
  from: string;
  to: string;
  body: string;
  receivedAt: string;
}

export interface SupplierAdapter {
  readonly key: string;
  readonly label: string;
  testConnection(ctx: SupplierRuntimeContext): Promise<SupplierConnectionTestResult>;
  fetchCatalog?(ctx: SupplierRuntimeContext): Promise<{ ok: boolean; items: unknown[]; errorMessage?: string }>;
  provision(ctx: SupplierRuntimeContext, req: SupplierProvisionRequest): Promise<SupplierProvisionResult>;
  retrieveDetails?(
    ctx: SupplierRuntimeContext,
    externalServiceId: string
  ): Promise<{ ok: boolean; data?: Record<string, unknown>; errorMessage?: string }>;
  renew?(
    ctx: SupplierRuntimeContext,
    params: { externalServiceId: string; durationDays: number; idempotencyKey: string }
  ): Promise<SupplierProvisionResult>;
  suspendOrRelease?(
    ctx: SupplierRuntimeContext,
    externalServiceId: string
  ): Promise<{ ok: boolean; errorMessage?: string }>;
  checkUsage?(ctx: SupplierRuntimeContext, externalServiceId: string): Promise<SupplierUsageResult>;
  topUpBandwidth?(
    ctx: SupplierRuntimeContext,
    params: { externalServiceId: string; amountGb: number; idempotencyKey: string }
  ): Promise<{ ok: boolean; errorMessage?: string }>;
  fetchInboundMessages?(
    ctx: SupplierRuntimeContext,
    externalServiceId: string
  ): Promise<{ ok: boolean; supported: boolean; messages: SupplierMessageRecord[]; errorMessage?: string }>;
}
