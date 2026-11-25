import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/site-url";

function sanitizeNextPath(nextParam: string | null): string {
  if (!nextParam || !nextParam.startsWith("/") || nextParam.startsWith("//")) {
    return "/dashboard";
  }
  return nextParam;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const appUrl = getAppUrl(request);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const next = sanitizeNextPath(searchParams.get("next"));

  if (errorParam) {
    const msg = errorDescription || "Your verification link is invalid or has expired.";
    return NextResponse.redirect(`${appUrl}/login?auth_error=${encodeURIComponent(msg)}`);
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const msg = error.message.toLowerCase().includes("expired")
        ? "This verification link has expired or was already used. Sign in or request a new link."
        : error.message;
      return NextResponse.redirect(`${appUrl}/login?auth_error=${encodeURIComponent(msg)}`);
    }
    return NextResponse.redirect(`${appUrl}${next}`);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) {
      const msg = error.message.toLowerCase().includes("expired")
        ? "This verification link has expired or was already used. Sign in or request a new link."
        : error.message;
      return NextResponse.redirect(`${appUrl}/login?auth_error=${encodeURIComponent(msg)}`);
    }
    return NextResponse.redirect(`${appUrl}${next}`);
  }

  return NextResponse.redirect(
    `${appUrl}/login?auth_error=${encodeURIComponent("Missing verification token. Please sign in or request a new verification link.")}`
  );
}
