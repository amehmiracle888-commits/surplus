import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditLogInput {
  actorId?: string | null;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      actor_id: input.actorId ?? null,
      actor_role: input.actorRole ?? "system",
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      before_state: input.beforeState ?? null,
      after_state: input.afterState ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
