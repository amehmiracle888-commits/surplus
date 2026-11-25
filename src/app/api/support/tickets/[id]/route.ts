import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ReplySchema = z.object({
  message: z.string().min(1).max(4000).optional(),
  close: z.boolean().optional(),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        path: z.string(),
        mime_type: z.string().optional(),
        size: z.number().optional(),
      })
    )
    .optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCustomer();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = ReplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: ticket } = await admin
      .from("support_tickets")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (parsed.data.message) {
      await admin.from("support_messages").insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_role: "customer",
        message: parsed.data.message,
        attachments: parsed.data.attachments ?? [],
      });
      await admin
        .from("support_tickets")
        .update({ status: "open", updated_at: new Date().toISOString() })
        .eq("id", ticket.id);
    }

    if (parsed.data.close) {
      await admin
        .from("support_tickets")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", ticket.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}
