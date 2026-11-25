import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateReference } from "@/lib/utils";
import { sendNotification } from "@/lib/notifications";

const CreateTicketSchema = z.object({
  category: z.string().min(2).max(50),
  subject: z.string().min(4).max(160),
  orderId: z.string().uuid().optional().nullable(),
  message: z.string().min(5).max(4000),
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

export async function GET() {
  try {
    const user = await requireCustomer();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("support_tickets")
      .select("*, messages:support_messages(*)")
      .eq("user_id", user.id)
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
    const user = await requireCustomer();
    const body = await request.json();
    const parsed = CreateTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid ticket data", details: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createAdminClient();
    if (parsed.data.orderId) {
      const { data: order } = await admin
        .from("orders")
        .select("id")
        .eq("id", parsed.data.orderId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!order) {
        return NextResponse.json({ error: "Referenced order not found" }, { status: 404 });
      }
    }

    const ticketNumber = generateReference("TKT");
    const { data: ticket, error: ticketErr } = await admin
      .from("support_tickets")
      .insert({
        ticket_number: ticketNumber,
        user_id: user.id,
        order_id: parsed.data.orderId ?? null,
        category: parsed.data.category,
        subject: parsed.data.subject,
        priority: "medium",
        status: "open",
      })
      .select("*")
      .single();

    if (ticketErr || !ticket) {
      return NextResponse.json({ error: ticketErr?.message || "Failed to create ticket" }, { status: 500 });
    }

    await admin.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_role: "customer",
      message: parsed.data.message,
      attachments: parsed.data.attachments ?? [],
    });

    await sendNotification({
      userId: user.id,
      type: "ticket_update",
      recipientEmail: user.email,
      subject: `Support Ticket Opened - ${ticketNumber}`,
      bodyText: `Your support ticket ${ticketNumber} (${parsed.data.subject}) has been created.`,
      bodyHtml: `<p>Your support ticket <strong>${ticketNumber}</strong> has been created. Our support team will respond shortly.</p>`,
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to open support ticket" }, { status: 500 });
  }
}
