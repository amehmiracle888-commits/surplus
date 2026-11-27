import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AuthError, requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createPinUnlockToken,
  hashPin,
  PIN_COOKIE_NAME,
  verifyPinHash,
} from "@/lib/pin-lock";

const SetupSchema = z.object({
  action: z.enum(["set", "remove"]).default("set"),
  pin: z.string().regex(/^\d{4}$/, "Passcode must be 4 digits").optional(),
  currentPin: z.string().regex(/^\d{4}$/).optional(),
  accountPassword: z.string().min(1).optional(),
});

async function verifyAccountPassword(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;

  const client = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}

export async function POST(request: Request) {
  try {
    const user = await requireCustomer();
    const body = await request.json();
    const parsed = SetupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please enter a valid 4-digit passcode." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: profile, error: fetchErr } = await admin
      .from("profiles")
      .select("pin_hash")
      .eq("id", user.id)
      .maybeSingle();

    if (fetchErr) {
      if (fetchErr.message.includes("pin_hash")) {
        return NextResponse.json(
          { error: "Database migration 202611270004_account_pin_lock.sql is required first." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const hasExistingPin = Boolean(profile?.pin_hash);

    if (hasExistingPin) {
      let authorized = false;
      if (parsed.data.currentPin) {
        authorized = verifyPinHash(parsed.data.currentPin, profile?.pin_hash);
      } else if (parsed.data.accountPassword) {
        authorized = await verifyAccountPassword(user.email, parsed.data.accountPassword);
      }

      if (!authorized) {
        return NextResponse.json(
          { error: "Current 4-digit PIN or account password is incorrect." },
          { status: 401 }
        );
      }
    }

    if (parsed.data.action === "remove") {
      const { error: updateErr } = await admin
        .from("profiles")
        .update({ pin_hash: null, pin_updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      const res = NextResponse.json({ hasPin: false, message: "4-digit PIN lock disabled." });
      res.cookies.delete(PIN_COOKIE_NAME);
      return res;
    }

    if (!parsed.data.pin) {
      return NextResponse.json({ error: "New 4-digit PIN is required." }, { status: 400 });
    }

    const newHash = hashPin(parsed.data.pin);
    const { error: saveErr } = await admin
      .from("profiles")
      .update({ pin_hash: newHash, pin_updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (saveErr) {
      return NextResponse.json({ error: saveErr.message }, { status: 500 });
    }

    const res = NextResponse.json({
      hasPin: true,
      unlocked: true,
      message: hasExistingPin ? "4-digit PIN updated." : "4-digit PIN lock enabled.",
    });
    res.cookies.set(PIN_COOKIE_NAME, createPinUnlockToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return res;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[PIN setup error]", err);
    return NextResponse.json({ error: "Unable to save passcode." }, { status: 500 });
  }
}
