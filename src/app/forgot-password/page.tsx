"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (resetErr) {
        setError(resetErr.message);
        setLoading(false);
        return;
      }
      setSent(true);
      setLoading(false);
    } catch {
      setError("Failed to request password reset.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070B19] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0D1326] p-8 shadow-2xl">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          Back to Sign In
        </Link>

        {sent ? (
          <div className="mt-6 space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white">Reset link sent</h1>
            <p className="text-sm text-slate-300">
              If an account exists for <strong>{email}</strong>, a password recovery link has been
              sent to your inbox.
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-bold text-white">Forgot password</h1>
            <p className="mt-1.5 text-sm text-slate-400">
              Enter your email address and we will send you a password reset link.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300">Email address</label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-800 bg-[#070B19] py-2.5 pl-10 pr-4 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-3 text-sm font-semibold text-white"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Reset Link
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
