import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasAnon = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasService = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasBachs = Boolean(process.env.BACHS_SECRET_KEY);

  if (!hasUrl || !hasAnon || !hasService) {
    return NextResponse.json(
      {
        ok: false,
        supabaseConfigured: false,
        bachsConfigured: hasBachs,
        message:
          "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY in .env.local",
      },
      { status: 503 }
    );
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("product_categories")
      .select("slug")
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          supabaseConfigured: true,
          schemaReady: false,
          bachsConfigured: hasBachs,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      supabaseConfigured: true,
      schemaReady: true,
      bachsConfigured: hasBachs,
      categoriesCount: (data ?? []).length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        supabaseConfigured: true,
        schemaReady: false,
        error: err instanceof Error ? err.message : "Failed to connect to Supabase",
      },
      { status: 500 }
    );
  }
}
