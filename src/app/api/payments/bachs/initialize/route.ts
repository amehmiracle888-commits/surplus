import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { BachsApiError, createBachsCheckoutSession } from "@/lib/bachs";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getAppUrl } from "@/lib/site-url";
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
      return NextResponse.json({ error: "Please enter a valid deposit amount." }, { status: 400 });
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

    const appUrl = getAppUrl(request);
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
      metadata: {
        amount_naira: parsed.data.amountNaira,
        checkout_id: session.id,
        callback_origin: appUrl,
      },
    });

    if (insertErr) {
      console.error("[Bachs initialize insertErr]", insertErr);
      return NextResponse.json({ error: "Unable to record payment session." }, { status: 500 });
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
    if (err instanceof BachsApiError) {
      const userMessage = err.detail?.includes("localhost")
        ? "Payment gateway requires a public HTTPS application URL. Configure NEXT_PUBLIC_APP_URL to your deployed domain or test with a sandbox key."
        : err.message;
      return NextResponse.json({ error: userMessage }, { status: err.status >= 400 && err.status < 500 ? 400 : 502 });
    }
    console.error("[Bachs initialize error]", err);
    return NextResponse.json(
      { error: "Unable to initialize payment right now. Please try again." },
      { status: 500 }
    );
  }
}
