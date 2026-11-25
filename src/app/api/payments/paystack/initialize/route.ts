import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { initializePaystackTransaction } from "@/lib/paystack";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { generateReference, nairaToKobo } from "@/lib/utils";

const DepositSchema = z.object({
  purpose: z.literal("wallet_deposit"),
  amountNaira: z.number().positive(),
  channel: z.enum(["card", "bank_transfer", "ussd", "bank"]).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireCustomer();
    const ip = getClientIp(request);
    const rl = checkRateLimit(`paystack-init:${user.id}:${ip}`, 15, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many payment requests. Please wait a minute." }, { status: 429 });
    }

    const body = await request.json();
    const parsed = DepositSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid deposit payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: limitsRow } = await admin
      .from("website_settings")
      .select("value")
      .eq("key", "payment_limits")
      .maybeSingle();

    const limits = (limitsRow?.value ?? { minDepositNaira: 500, maxDepositNaira: 5000000 }) as {
      minDepositNaira: number;
      maxDepositNaira: number;
    };

    if (parsed.data.amountNaira < limits.minDepositNaira || parsed.data.amountNaira > limits.maxDepositNaira) {
      return NextResponse.json(
        {
          error: `Deposit amount must be between ₦${limits.minDepositNaira.toLocaleString()} and ₦${limits.maxDepositNaira.toLocaleString()}`,
        },
        { status: 400 }
      );
    }

    const amountKobo = nairaToKobo(parsed.data.amountNaira);
    const reference = generateReference("DEP");

    const { data: wallet } = await admin
      .from("wallets")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!wallet) {
      return NextResponse.json({ error: "Customer wallet not found" }, { status: 404 });
    }

    const { error: insertErr } = await admin.from("payment_transactions").insert({
      user_id: user.id,
      wallet_id: wallet.id,
      purpose: "wallet_deposit",
      provider: "paystack",
      reference,
      channel: parsed.data.channel ?? "card",
      amount_kobo: amountKobo,
      currency: "NGN",
      status: "initialized",
      metadata: { amount_naira: parsed.data.amountNaira },
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const paystack = await initializePaystackTransaction({
      email: user.email,
      amountKobo,
      reference,
      callbackUrl: `${appUrl}/dashboard/wallet?reference=${encodeURIComponent(reference)}`,
      channels: parsed.data.channel ? [parsed.data.channel] : ["card", "bank_transfer", "ussd", "bank"],
      metadata: { user_id: user.id, purpose: "wallet_deposit" },
    });

    return NextResponse.json({
      authorization_url: paystack.authorization_url,
      access_code: paystack.access_code,
      reference: paystack.reference,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to initialize deposit" },
      { status: 500 }
    );
  }
}
