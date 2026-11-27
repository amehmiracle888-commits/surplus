"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Delete, KeyRound, Loader2, Lock, LogOut, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { createClient } from "@/lib/supabase/client";

interface PinLockScreenProps {
  mode: "unlock" | "setup";
  brandName: string;
  userEmail: string;
  onSuccess?: () => void;
  onSkip?: () => void;
}

const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["clear", "0", "back"],
] as const;

export function PinLockScreen({
  mode,
  brandName,
  userEmail,
  onSuccess,
  onSkip,
}: PinLockScreenProps) {
  const router = useRouter();
  const [digits, setDigits] = useState("");
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const [newPinForReset, setNewPinForReset] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  const submitPin = useCallback(
    async (entered: string) => {
      if (entered.length !== 4 || submitting) return;
      setError(null);

      if (mode === "setup") {
        if (!firstPin) {
          setFirstPin(entered);
          setDigits("");
          return;
        }
        if (entered !== firstPin) {
          setError("Passcodes did not match. Enter a new 4-digit PIN.");
          setFirstPin(null);
          setDigits("");
          return;
        }

        setSubmitting(true);
        try {
          const res = await fetch("/api/auth/pin/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "set", pin: entered }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || "Unable to save 4-digit PIN.");
            setFirstPin(null);
            setDigits("");
            return;
          }
          onSuccess?.();
          router.refresh();
        } catch {
          setError("Network error saving passcode.");
          setDigits("");
        } finally {
          setSubmitting(false);
        }
        return;
      }

      // Unlock mode
      setSubmitting(true);
      try {
        const res = await fetch("/api/auth/pin/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: entered }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Incorrect 4-digit passcode.");
          setDigits("");
          return;
        }
        onSuccess?.();
        router.refresh();
      } catch {
        setError("Unable to verify passcode right now.");
        setDigits("");
      } finally {
        setSubmitting(false);
      }
    },
    [firstPin, mode, onSuccess, router, submitting]
  );

  const pushDigit = useCallback(
    (d: string) => {
      if (submitting || recoveryOpen) return;
      setError(null);
      setDigits((prev) => {
        if (prev.length >= 4) return prev;
        const next = `${prev}${d}`;
        if (next.length === 4) {
          window.setTimeout(() => submitPin(next), 80);
        }
        return next;
      });
    },
    [recoveryOpen, submitPin, submitting]
  );

  const popDigit = useCallback(() => {
    if (submitting || recoveryOpen) return;
    setError(null);
    setDigits((prev) => prev.slice(0, -1));
  }, [recoveryOpen, submitting]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (recoveryOpen) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        pushDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        popDigit();
      } else if (e.key === "Escape") {
        setDigits("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [popDigit, pushDigit, recoveryOpen]);

  async function handleSignOut() {
    await fetch("/api/auth/pin/lock", { method: "POST" }).catch(() => null);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handlePasswordResetPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{4}$/.test(newPinForReset)) {
      setError("New passcode must be exactly 4 digits.");
      return;
    }
    setResetBusy(true);
    try {
      const res = await fetch("/api/auth/pin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set",
          pin: newPinForReset,
          accountPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed.");
        return;
      }
      onSuccess?.();
      router.refresh();
    } catch {
      setError("Unable to reset PIN right now.");
    } finally {
      setResetBusy(false);
    }
  }

  const heading =
    mode === "setup"
      ? firstPin
        ? "Confirm 4-Digit Passcode"
        : "Set 4-Digit Passcode"
      : "Enter 4-Digit Passcode";

  const subheading =
    mode === "setup"
      ? firstPin
        ? "Re-enter the same 4 digits to enable instant screen lock."
        : "Protect your wallet, orders, and credentials when returning to your account."
      : "Your session is active. Enter your 4-digit PIN to unlock access.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070B19]/95 px-4 py-6 backdrop-blur-xl">
      {/* Centered phone-sized lock bar */}
      <div className="w-full max-w-[350px] rounded-[28px] border border-slate-800/90 bg-[#0D1326] p-6 shadow-2xl shadow-blue-950/60">
        {/* Top phone handle indicator */}
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-slate-700/80" />

        <div className="flex flex-col items-center text-center">
          <BrandLogo brandName={brandName} size="md" />

          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-300">
            {mode === "setup" ? <ShieldCheck className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {userEmail}
          </div>

          <h1 className="mt-4 text-lg font-bold text-white">{heading}</h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{subheading}</p>
        </div>

        {recoveryOpen ? (
          <form onSubmit={handlePasswordResetPin} className="mt-5 space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300">
                Account Password
              </label>
              <input
                type="password"
                required
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                placeholder="Enter your login password"
                className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-300">
                New 4-Digit PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                required
                value={newPinForReset}
                onChange={(e) => setNewPinForReset(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="mt-1 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-center font-mono text-base tracking-[0.5em] text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={resetBusy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-2.5 text-xs font-semibold text-white"
            >
              {resetBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Verify Password &amp; Reset PIN
            </button>
            <button
              type="button"
              onClick={() => {
                setRecoveryOpen(false);
                setError(null);
              }}
              className="w-full py-1.5 text-xs text-slate-400 hover:text-white"
            >
              &larr; Back to Keypad
            </button>
          </form>
        ) : (
          <>
            {/* 4-Digit Dot Boxes */}
            <div className="mt-6 flex justify-center gap-3">
              {[0, 1, 2, 3].map((idx) => {
                const filled = idx < digits.length;
                return (
                  <div
                    key={idx}
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all ${
                      filled
                        ? "border-blue-500 bg-blue-500/15 shadow-sm shadow-blue-500/25"
                        : "border-slate-800 bg-[#070B19]"
                    }`}
                  >
                    <span
                      className={`h-3 w-3 rounded-full transition-transform ${
                        filled
                          ? "scale-100 bg-gradient-to-br from-blue-400 to-violet-400"
                          : "scale-75 bg-slate-700"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-200">
                {error}
              </div>
            )}

            {submitting && (
              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-blue-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {mode === "setup" ? "Saving passcode..." : "Unlocking account..."}
              </div>
            )}

            {/* Tactile 3x4 Phone Keypad */}
            <div className="mt-6 grid grid-cols-3 gap-2.5">
              {KEYPAD_ROWS.flat().map((key) => {
                if (key === "clear") {
                  return (
                    <button
                      key="clear"
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setDigits("");
                        setError(null);
                      }}
                      className="flex h-12 items-center justify-center rounded-2xl border border-slate-800/80 bg-[#070B19] text-xs font-medium text-slate-400 transition hover:border-slate-700 hover:text-white active:scale-95"
                    >
                      Clear
                    </button>
                  );
                }

                if (key === "back") {
                  return (
                    <button
                      key="back"
                      type="button"
                      disabled={submitting}
                      onClick={popDigit}
                      aria-label="Backspace"
                      className="flex h-12 items-center justify-center rounded-2xl border border-slate-800/80 bg-[#070B19] text-slate-300 transition hover:border-slate-700 hover:text-white active:scale-95"
                    >
                      <Delete className="h-4 w-4" />
                    </button>
                  );
                }

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={submitting}
                    onClick={() => pushDigit(key)}
                    className="flex h-12 items-center justify-center rounded-2xl border border-slate-800 bg-[#070B19] text-lg font-semibold text-white transition hover:border-blue-500/40 hover:bg-slate-900 active:scale-95"
                  >
                    {key}
                  </button>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="mt-5 flex items-center justify-between border-t border-slate-800/80 pt-4 text-xs">
              {mode === "unlock" ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryOpen(true);
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1 text-blue-400 hover:underline"
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Forgot PIN?
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-white"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign Out
                  </button>
                </>
              ) : (
                <>
                  <span className="text-[11px] text-slate-500">Manage anytime in Settings</span>
                  {onSkip && (
                    <button
                      type="button"
                      onClick={onSkip}
                      className="font-medium text-slate-300 hover:text-white"
                    >
                      Skip for now
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
