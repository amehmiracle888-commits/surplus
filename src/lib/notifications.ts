import { createAdminClient } from "@/lib/supabase/admin";

export interface NotificationPayload {
  userId?: string | null;
  type:
    | "welcome"
    | "payment_success"
    | "delivery_success"
    | "delivery_failed"
    | "expiry_reminder"
    | "renewal_success"
    | "wallet_deposit"
    | "ticket_update";
  recipientEmail?: string | null;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  metadata?: Record<string, unknown>;
}

interface EmailConfigRow {
  provider?: "resend" | "webhook" | "disabled";
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  webhookUrl?: string;
  templates?: Record<string, { subject?: string; enabled?: boolean }>;
}

export function renderEmailTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const admin = createAdminClient();

  // Always record an in-app notification if userId is present
  if (payload.userId) {
    await admin.from("notifications").insert({
      user_id: payload.userId,
      type: payload.type,
      channel: "in_app",
      recipient_email: payload.recipientEmail ?? null,
      subject: payload.subject,
      body_text: payload.bodyText,
      status: "sent",
      metadata: payload.metadata ?? {},
    });
  }

  if (!payload.recipientEmail) return;

  const { data: emailSetting } = await admin
    .from("website_settings")
    .select("value")
    .eq("key", "email_config")
    .maybeSingle();

  const emailConfig = (emailSetting?.value ?? {}) as EmailConfigRow;
  const templateCfg = emailConfig.templates?.[payload.type];
  if (templateCfg && templateCfg.enabled === false) {
    return;
  }

  const provider = emailConfig.provider ?? (process.env.EMAIL_PROVIDER as "resend" | "webhook") ?? "resend";
  const fromEmail = emailConfig.fromEmail || process.env.EMAIL_FROM || "noreply@yourdomain.com";
  const fromName = emailConfig.fromName || "Digital Services";

  let status: "sent" | "failed" | "queued" = "queued";
  let providerMessageId: string | null = null;
  let errorMessage: string | null = null;

  try {
    if (provider === "resend" && process.env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [payload.recipientEmail],
          reply_to: emailConfig.replyTo || undefined,
          subject: payload.subject,
          html: payload.bodyHtml,
          text: payload.bodyText,
        }),
      });
      const json = await res.json();
      if (res.ok && json.id) {
        status = "sent";
        providerMessageId = String(json.id);
      } else {
        status = "failed";
        errorMessage = json.message || `Resend HTTP ${res.status}`;
      }
    } else if (provider === "webhook" && emailConfig.webhookUrl) {
      const res = await fetch(emailConfig.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: payload.recipientEmail,
          subject: payload.subject,
          html: payload.bodyHtml,
          text: payload.bodyText,
          type: payload.type,
        }),
      });
      status = res.ok ? "sent" : "failed";
      if (!res.ok) errorMessage = `Email webhook HTTP ${res.status}`;
    } else {
      status = "queued";
      errorMessage = "Email provider credentials not configured";
    }
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : "Email dispatch failed";
  }

  await admin.from("notifications").insert({
    user_id: payload.userId ?? null,
    type: payload.type,
    channel: "email",
    recipient_email: payload.recipientEmail,
    subject: payload.subject,
    body_html: payload.bodyHtml,
    body_text: payload.bodyText,
    status,
    provider_message_id: providerMessageId,
    error_message: errorMessage,
    metadata: payload.metadata ?? {},
  });
}
