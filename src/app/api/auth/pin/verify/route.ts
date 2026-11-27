import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  createPinUnlockToken,
  isValidPinFormat,
  PIN_COOKIE_NAME,
  verifyPinHash,
} from "@/lib/pin-lock";

const VerifySchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "Passcode must be 4 digits"),
});

export async function POST(request: Request) {
  try {
    const user = await requireCustomer();
    const ip = getClientIp(request);
    const rl = checkRateLimit(`pin-verify:${user.id}:${ip}`, 5, 5 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many incorrect PIN attempts. Please wait 5 minutes and try again." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = VerifySchema.safeParse(body);
    if (!parsed.success || !isValidPinFormat(parsed.data.pin)) {
      return NextResponse.json({ error: "Enter a valid 4-digit passcode." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("pin_hash")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!profile?.pin_hash) {
      return NextResponse.json({ error: "No 4-digit passcode configured for this account." }, { status: 400 });
    }

    if (!verifyPinHash(parsed.data.pin, profile.pin_hash)) {
      return NextResponse.json({ error: "Incorrect 4-digit passcode." }, { status: 401 });
    }

    const token = createPinUnlockToken(user.id);
    const response = NextResponse.json({ unlocked: true });
    response.cookies.set(PIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return response;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[PIN verify error]", err);
    return NextResponse.json({ error: "Unable to verify passcode." }, { status: 500 });
  }
}
