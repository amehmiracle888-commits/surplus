import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import crypto from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats an integer kobo amount as Nigerian Naira (₦). */
export function formatNaira(kobo: number | null | undefined): string {
  const safe = typeof kobo === "number" && Number.isFinite(kobo) ? kobo : 0;
  const naira = safe / 100;
  return `₦${naira.toLocaleString("en-NG", {
    minimumFractionDigits: naira % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

/** Generates a collision-resistant reference with an explicit prefix. */
export function generateReference(prefix: string): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${datePart}-${randomPart}`;
}

export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function formatDurationLabel(days: number, cycle?: string): string {
  if (cycle === "monthly" || days === 30) return "1 Month";
  if (cycle === "quarterly" || days === 90) return "3 Months";
  if (cycle === "biannual" || days === 180) return "6 Months";
  if (cycle === "annual" || days === 365) return "12 Months";
  if (days === 7) return "7 Days";
  if (days === 1) return "24 Hours";
  return `${days} Days`;
}
