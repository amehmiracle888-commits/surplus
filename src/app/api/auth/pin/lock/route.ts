import { NextResponse } from "next/server";
import { AuthError, requireCustomer } from "@/lib/auth";
import { PIN_COOKIE_NAME } from "@/lib/pin-lock";

export async function POST() {
  try {
    await requireCustomer();
    const res = NextResponse.json({ locked: true });
    res.cookies.delete(PIN_COOKIE_NAME);
    return res;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to lock account" }, { status: 500 });
  }
}
