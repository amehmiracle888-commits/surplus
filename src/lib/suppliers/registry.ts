import { decryptSecret } from "@/lib/crypto";
import { ConfigurableRestAdapter } from "@/lib/suppliers/adapters/configurable-rest";
import { ManualFulfilmentAdapter } from "@/lib/suppliers/adapters/manual";
import type {
  SupplierAdapter,
  SupplierAuthMethod,
  SupplierEndpointConfig,
  SupplierRuntimeContext,
} from "@/lib/suppliers/types";

const adapters = new Map<string, SupplierAdapter>();

function registerDefaults() {
  const manual = new ManualFulfilmentAdapter();
  const rest = new ConfigurableRestAdapter();
  adapters.set(manual.key, manual);
  adapters.set(rest.key, rest);
}

registerDefaults();

export function getSupplierAdapter(adapterKey: string | null | undefined): SupplierAdapter {
  if (!adapterKey) return adapters.get("manual")!;
  return adapters.get(adapterKey) ?? adapters.get("custom_rest")!;
}

export function listRegisteredAdapters(): { key: string; label: string }[] {
  return Array.from(adapters.values()).map((a) => ({ key: a.key, label: a.label }));
}

export interface SupplierDbRow {
  id: string;
  name: string;
  adapter_key: string;
  category_slug: string;
  api_base_url: string | null;
  auth_method: string;
  api_key_encrypted: string | null;
  api_secret_encrypted: string | null;
  config: Record<string, unknown> | null;
}

export function buildSupplierContext(row: SupplierDbRow): SupplierRuntimeContext {
  return {
    supplierId: row.id,
    supplierName: row.name,
    adapterKey: row.adapter_key,
    categorySlug: row.category_slug,
    apiBaseUrl: row.api_base_url || "",
    authMethod: (row.auth_method || "bearer") as SupplierAuthMethod,
    apiKey: row.api_key_encrypted ? decryptSecret(row.api_key_encrypted) : "",
    apiSecret: row.api_secret_encrypted ? decryptSecret(row.api_secret_encrypted) : "",
    config: (row.config ?? {}) as SupplierEndpointConfig,
  };
}
