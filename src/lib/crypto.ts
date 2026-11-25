import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const raw = process.env.SUPPLIER_SECRETS_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    // Derive a deterministic 32-byte key from SUPABASE_SERVICE_ROLE_KEY as a fallback in dev/build,
    // while strictly warning if SUPPLIER_SECRETS_ENCRYPTION_KEY is missing in production.
    const fallbackSeed = process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-only-insecure-fallback-seed";
    if (process.env.NODE_ENV === "production" && !raw) {
      throw new Error("SUPPLIER_SECRETS_ENCRYPTION_KEY must be configured in production");
    }
    return crypto.createHash("sha256").update(fallbackSeed).digest();
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Encrypts sensitive strings (supplier API keys, customer service credentials) using AES-256-GCM.
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

/**
 * Decrypts AES-256-GCM ciphertext produced by encryptSecret.
 */
export function decryptSecret(ciphertext: string | null | undefined): string {
  if (!ciphertext) return "";
  const parts = ciphertext.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function encryptJsonSecret<T>(payload: T): string {
  return encryptSecret(JSON.stringify(payload));
}

export function decryptJsonSecret<T>(ciphertext: string | null | undefined): T | null {
  if (!ciphertext) return null;
  const plain = decryptSecret(ciphertext);
  return JSON.parse(plain) as T;
}
