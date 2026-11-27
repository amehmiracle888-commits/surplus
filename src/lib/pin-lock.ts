import crypto from "crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const PIN_COOKIE_NAME = "ipcore_pin_unlock";
const PIN_SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours max per browser session

function getPinSigningSecret(): string {
  return (
    process.env.SUPPLIER_SECRETS_ENCRYPTION_KEY ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "dev-only-pin-signing-seed"
  );
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * Hashes a 4-digit PIN using a per-user random 16-byte salt and scrypt.
 */
export function hashPin(pin: string): string {
  if (!isValidPinFormat(pin)) {
    throw new Error("Passcode must be exactly 4 digits");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPinHash(pin: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !isValidPinFormat(pin)) return false;
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  try {
    const derived = crypto.scryptSync(pin, salt, 32);
    const expected = Buffer.from(expectedHex, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function createPinUnlockToken(userId: string): string {
  const expiresAt = Date.now() + PIN_SESSION_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const sig = crypto
    .createHmac("sha256", getPinSigningSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

export function verifyPinUnlockToken(
  token: string | undefined,
  expectedUserId: string
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [uid, expStr, sigHex] = parts;
  if (uid !== expectedUserId) return false;

  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  const expectedSig = crypto
    .createHmac("sha256", getPinSigningSecret())
    .update(`${uid}.${expStr}`)
    .digest("hex");

  try {
    const actualBuf = Buffer.from(sigHex, "hex");
    const expectedBuf = Buffer.from(expectedSig, "hex");
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

export interface PinLockState {
  schemaReady: boolean;
  hasPin: boolean;
  unlocked: boolean;
}

export async function getPinLockState(userId: string): Promise<PinLockState> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("pin_hash")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      // Gracefully allow access if migration 202611270004 hasn't been executed yet
      return { schemaReady: false, hasPin: false, unlocked: true };
    }

    const hasPin = Boolean(data?.pin_hash);
    if (!hasPin) {
      return { schemaReady: true, hasPin: false, unlocked: true };
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(PIN_COOKIE_NAME)?.value;
    const unlocked = verifyPinUnlockToken(token, userId);
    return { schemaReady: true, hasPin: true, unlocked };
  } catch {
    return { schemaReady: false, hasPin: false, unlocked: true };
  }
}
