import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { decryptJsonSecret, decryptSecret, encryptJsonSecret, encryptSecret } from "@/lib/crypto";
import { verifyPaystackWebhookSignature } from "@/lib/paystack";
import { verifyBachsWebhookSignature } from "@/lib/bachs";
import { formatNaira, koboToNaira, nairaToKobo } from "@/lib/utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { renderEmailTemplate } from "@/lib/notifications";
import { getSupplierAdapter } from "@/lib/suppliers/registry";

describe("Encryption & Credential Vault", () => {
  it("encrypts and decrypts supplier secrets using AES-256-GCM", () => {
    const original = "sk_live_supplier_secret_987654321";
    const cipher = encryptSecret(original);
    expect(cipher).not.toBe(original);
    expect(cipher.split(".")).toHaveLength(3);
    expect(decryptSecret(cipher)).toBe(original);
  });

  it("encrypts and decrypts JSON credential objects cleanly", () => {
    const creds = { username: "vpn_user_01", password: "strongPassword!9", server: "uk-lon" };
    const encrypted = encryptJsonSecret(creds);
    expect(decryptJsonSecret(encrypted)).toEqual(creds);
  });
});

describe("Bachs.io Webhook Signature Verification", () => {
  it("accepts valid X-Bachs-Signature HMAC-SHA256 within 300s and rejects tampered or expired payloads", () => {
    const secret = "whsec_test_bachs_secret_123";
    const nowSec = 1_764_000_000;
    const timestamp = String(nowSec - 30);
    const payload = JSON.stringify({
      type: "checkout.completed",
      data: { object: { id: "cs_test_123", status: "complete", payment_status: "paid" } },
    });
    const sig = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    expect(verifyBachsWebhookSignature(payload, sig, timestamp, secret, nowSec)).toBe(true);
    expect(verifyBachsWebhookSignature(payload + " ", sig, timestamp, secret, nowSec)).toBe(false);
    expect(verifyBachsWebhookSignature(payload, sig, String(nowSec - 600), secret, nowSec)).toBe(false);
    expect(verifyBachsWebhookSignature(payload, "deadbeef", timestamp, secret, nowSec)).toBe(false);
    expect(verifyBachsWebhookSignature(payload, null, timestamp, secret, nowSec)).toBe(false);
  });
});

describe("Paystack Webhook Signature Verification", () => {
  it("accepts valid HMAC-SHA512 webhook signature and rejects tampered payloads", () => {
    const secret = "sk_test_paystack_example_secret";
    const payload = JSON.stringify({ event: "charge.success", data: { reference: "DEP-123" } });
    const sig = crypto.createHmac("sha512", secret).update(payload).digest("hex");

    expect(verifyPaystackWebhookSignature(payload, sig, secret)).toBe(true);
    expect(verifyPaystackWebhookSignature(payload + " ", sig, secret)).toBe(false);
    expect(verifyPaystackWebhookSignature(payload, "deadbeef", secret)).toBe(false);
    expect(verifyPaystackWebhookSignature(payload, null, secret)).toBe(false);
  });
});

describe("Nigerian Naira Currency Formatting", () => {
  it("converts between Naira and Kobo accurately and formats Naira", () => {
    expect(nairaToKobo(3500)).toBe(350000);
    expect(koboToNaira(350000)).toBe(3500);
    expect(formatNaira(350000)).toBe("₦3,500");
    expect(formatNaira(150050)).toBe("₦1,500.50");
  });
});

describe("Rate Limiter & Email Templates", () => {
  it("enforces sliding-window request limits", () => {
    const key = `test-bucket-${Date.now()}`;
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(false);
  });

  it("interpolates template placeholders cleanly", () => {
    const out = renderEmailTemplate("Order {{orderReference}} credited {{amount}}", {
      orderReference: "ORD-2026-XYZ",
      amount: "₦5,000",
    });
    expect(out).toBe("Order ORD-2026-XYZ credited ₦5,000");
  });
});

describe("Supplier Adapters (No Fake Integrations)", () => {
  it("manual adapter enters pending_manual without fabricating credentials", async () => {
    const adapter = getSupplierAdapter("manual");
    const result = await adapter.provision(
      {
        supplierId: "sup-1",
        supplierName: "Manual Queue",
        adapterKey: "manual",
        categorySlug: "vpn",
        apiBaseUrl: "",
        authMethod: "none",
        apiKey: "",
        apiSecret: "",
        config: {},
      },
      {
        orderId: "ord-1",
        orderReference: "ORD-1",
        orderItemId: "item-1",
        idempotencyKey: "IDEMP-1",
        categorySlug: "vpn",
        externalProductId: "ext-1",
        quantity: 1,
        durationDays: 30,
        selectedOptions: {},
        customerEmail: "user@example.com",
      }
    );

    expect(result.status).toBe("pending_manual");
    expect(result.credentials).toBeUndefined();
  });

  it("custom_rest adapter refuses unconfigured endpoints instead of inventing URLs", async () => {
    const adapter = getSupplierAdapter("custom_rest");
    const testRes = await adapter.testConnection({
      supplierId: "sup-2",
      supplierName: "Unconfigured REST",
      adapterKey: "custom_rest",
      categorySlug: "proxy",
      apiBaseUrl: "https://api.example.com",
      authMethod: "bearer",
      apiKey: "key",
      apiSecret: "",
      config: {},
    });
    expect(testRes.ok).toBe(false);
  });
});
