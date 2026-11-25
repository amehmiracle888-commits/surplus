import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBachsCheckoutSession } from "@/lib/bachs";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { generateReference, nairaToKobo } from "@/lib/utils";

const DepositSchema = z.object({
  purpose: z.literal("wallet_deposit"),
  amountNaira: z.number().positive(),
});

export async function POST(request: Request) {
  try {
    const user = await requireCustomer();
    const ip = getClientIp(request);
    const rl = checkRateLimit(`bachs-init:${user.id}:${ip}`, 15, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many payment requests. Please wait a minute." }, { status: 429 });
    }

    const body = await request.json();
    const parsed = DepositSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid deposit payload" }, { status: 400 });
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
    const reference = generateReference("BCH");

    const { data: wallet } = await admin
      .from("wallets")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!wallet) {
      return NextResponse.json({ error: "Customer wallet not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const session = await createBachsCheckoutSession({
      amountKobo,
      email: user.email,
      name: user.fullName || undefined,
      reference,
      successUrl: `${appUrl}/dashboard/wallet?reference=${encodeURIComponent(reference)}`,
      cancelUrl: `${appUrl}/dashboard/wallet`,
      metadata: {
        user_id: user.id,
        purpose: "wallet_deposit",
      },
    });

    const { error: insertErr } = await admin.from("payment_transactions").insert({
      user_id: user.id,
      wallet_id: wallet.id,
      purpose: "wallet_deposit",
      provider: "bachs",
      reference,
      provider_reference: session.id,
      channel: "bachs_checkout",
      amount_kobo: amountKobo,
      currency: "NGN",
      status: "initialized",
      metadata: { amount_naira: parsed.data.amountNaira, checkout_id: session.id },
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      checkout_url: session.checkout_url,
      checkout_id: session.id,
      reference,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to initialize Bachs deposit" },
      { status: 500 }
    );
  }
}
