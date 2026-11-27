"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SettingsClient({
  email,
  initialFullName,
  initialPhone,
  initialCountry,
  initialHasPin,
  pinSchemaReady,
}: {
  email: string;
  initialFullName: string;
  initialPhone: string;
  initialCountry: string;
  initialHasPin: boolean;
  pinSchemaReady: boolean;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);
  const [country, setCountry] = useState(initialCountry);
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [hasPin, setHasPin] = useState(initialHasPin);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    setSavingProfile(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: err } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone, country })
        .eq("id", user.id);

      if (err) throw new Error(err.message);
      setNotice("Profile details updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    setSavingPassword(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) throw new Error(err.message);
      setNewPassword("");
      setNotice("Password updated successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  }

  async function savePin(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    if (!/^\d{4}$/.test(newPin)) {
      setError("4-digit PIN must contain exactly 4 numbers.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("New 4-digit PIN and confirmation do not match.");
      return;
    }
    setSavingPin(true);
    try {
      const res = await fetch("/api/auth/pin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set",
          pin: newPin,
          currentPin: hasPin ? currentPin : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save 4-digit PIN");
      setHasPin(true);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setNotice(data.message || "4-digit PIN saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save 4-digit PIN");
    } finally {
      setSavingPin(false);
    }
  }

  async function removePin() {
    setNotice(null);
    setError(null);
    if (!/^\d{4}$/.test(currentPin)) {
      setError("Enter your current 4-digit PIN to disable quick lock.");
      return;
    }
    setSavingPin(true);
    try {
      const res = await fetch("/api/auth/pin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", currentPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to disable 4-digit PIN");
      setHasPin(false);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setNotice("4-digit PIN lock disabled.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable 4-digit PIN");
    } finally {
      setSavingPin(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Update your profile details or change your authentication password.
        </p>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
          <h2 className="text-base font-semibold text-white">Customer Profile</h2>
          <div>
            <label className="block text-xs font-medium text-slate-300">Email</label>
            <input
              type="email"
              disabled
              value={email}
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19]/60 px-3.5 py-2.5 text-sm text-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white"
            />
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Profile
          </button>
        </form>

        <form onSubmit={changePassword} className="space-y-4 rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
          <h2 className="text-base font-semibold text-white">Change Password</h2>
          <div>
            <label className="block text-xs font-medium text-slate-300">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-sm text-white"
            />
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
            Update Password
          </button>
        </form>
      </div>

      <form onSubmit={savePin} className="space-y-4 rounded-2xl border border-slate-800 bg-[#0D1326] p-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <Lock className="h-4 w-4 text-blue-400" />
              4-Digit Account Passcode (Quick Lock)
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Requires a 4-digit passcode on a compact lock pad when returning to your signed-in account.
            </p>
          </div>
          <span
            className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
              hasPin
                ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {hasPin ? "PIN Enabled" : "Not Set"}
          </span>
        </div>

        {!pinSchemaReady && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            Database migration <code>202611270004_account_pin_lock.sql</code> has not been applied yet.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {hasPin && (
            <div>
              <label className="block text-xs font-medium text-slate-300">Current 4-Digit PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-center font-mono text-base tracking-[0.4em] text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300">
              {hasPin ? "New 4-Digit PIN" : "Create 4-Digit PIN"}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              required
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-center font-mono text-base tracking-[0.4em] text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Confirm 4-Digit PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              required
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-[#070B19] px-3.5 py-2.5 text-center font-mono text-base tracking-[0.4em] text-white"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={savingPin || !pinSchemaReady}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {savingPin && <Loader2 className="h-4 w-4 animate-spin" />}
            {hasPin ? "Update 4-Digit PIN" : "Enable 4-Digit PIN"}
          </button>

          {hasPin && (
            <button
              type="button"
              disabled={savingPin || !pinSchemaReady}
              onClick={removePin}
              className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
            >
              Disable PIN Lock
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
