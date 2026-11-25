import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

const AdminTicketActionSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "awaiting_customer", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  replyMessage: z.string().max(4000).optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("support_tickets")
      .select("*, messages:support_messages(*), profile:profiles(email, full_name)")
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tickets: data ?? [] });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load tickets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = await request.json();
    const parsed = AdminTicketActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid ticket update payload" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: ticket } = await admin
      .from("support_tickets")
      .select("*, profile:profiles(email)")
      .eq("id", parsed.data.ticketId)
      .single();

    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    if (parsed.data.replyMessage && parsed.data.replyMessage.trim().length > 0) {
      await admin.from("support_messages").insert({
        ticket_id: ticket.id,
        sender_id: actor.id,
        sender_role: "admin",
        message: parsed.data.replyMessage.trim(),
      });
    }

    const updates: Record<string, unknown> = { assigned_admin_id: actor.id };
    if (parsed.data.status) {
      updates.status = parsed.data.status;
      if (parsed.data.status === "closed") updates.closed_at = new Date().toISOString();
    } else if (parsed.data.replyMessage) {
      updates.status = "awaiting_customer";
    }
    if (parsed.data.priority) updates.priority = parsed.data.priority;

    await admin.from("support_tickets").update(updates).eq("id", ticket.id);

    const customerEmail = (ticket.profile as { email?: string } | null)?.email;
    await sendNotification({
      userId: ticket.user_id,
      type: "ticket_update",
      recipientEmail: customerEmail,
      subject: `Support Ticket Update - ${ticket.ticket_number}`,
      bodyText: `Your support ticket ${ticket.ticket_number} has been updated.`,
      bodyHtml: `<p>Your support ticket <strong>${ticket.ticket_number}</strong> has a new update. Sign in to view the response.</p>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}
