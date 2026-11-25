import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/types/database";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: AppRole;
  fullName: string;
  isSuspended: boolean;
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: profile }, { data: roles }] = await Promise.all([
    admin.from("profiles").select("full_name, is_suspended, email").eq("id", user.id).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const roleList = (roles ?? []).map((r) => r.role as AppRole);
  const role: AppRole = roleList.includes("super_admin")
    ? "super_admin"
    : roleList.includes("admin")
      ? "admin"
      : "customer";

  return {
    id: user.id,
    email: profile?.email || user.email || "",
    role,
    fullName: profile?.full_name || "",
    isSuspended: Boolean(profile?.is_suspended),
  };
}

export async function requireCustomer(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new AuthError("Authentication required", 401);
  }
  if (user.isSuspended) {
    throw new AuthError("Your account has been suspended. Please contact support.", 403);
  }
  return user;
}

export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new AuthError("Authentication required", 401);
  }
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new AuthError("Administrator privileges required", 403);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
