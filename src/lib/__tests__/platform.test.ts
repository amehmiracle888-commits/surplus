import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { decryptJsonSecret, decryptSecret, encryptJsonSecret, encryptSecret } from "@/lib/crypto";
import { verifyPaystackWebhookSignature } from "@/lib/paystack";
import { verifyBachsWebhookSignature } from "@/lib/bachs";
import { getAppUrl } from "@/lib/site-url";
import { formatNaira, koboToNaira, nairaToKobo } from "@/lib/utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { renderEmailTemplate } from "@/lib/notifications";
import { getSupplierAdapter } from "@/lib/suppliers/registry";
import {
  hasServiceSharedLogin,
  hasSharedLogin,
  isSharedOptionSelected,
} from "@/lib/product-notices";
import { calculateRetailPriceNaira, resolveEnabledCountries } from "@/lib/virtualsms-pricing";

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

describe("Canonical App URL Resolution (Email Verification & Payment Redirects)", () => {
  it("resolves forwarded production host over localhost NEXT_PUBLIC_APP_URL in production", () => {
    const prevEnv = process.env.NODE_ENV;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    try {
      (process.env as Record<string, string>).NODE_ENV = "production";
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

      const req = new Request("http://localhost:3000/api/payments/bachs/initialize", {
        headers: {
          "x-forwarded-host": "ipcore-prod.vercel.app",
          "x-forwarded-proto": "https",
        },
      });
      expect(getAppUrl(req)).toBe("https://ipcore-prod.vercel.app");
    } finally {
      (process.env as Record<string, string>).NODE_ENV = prevEnv || "test";
      if (prevApp !== undefined) process.env.NEXT_PUBLIC_APP_URL = prevApp;
    }
  });
});

describe("Product Notices & Shared Login Helpers", () => {
  it("detects shared login from options_schema and metadata and distinguishes personal selection", () => {
    const nord = {
      name: "NordVPN",
      short_description: "VPN subscription",
      description: "Encrypted VPN",
      metadata: { device_limit: 1 },
      options_schema: [
        {
          key: "plan_tier",
          label: "Account Tier",
          type: "select" as const,
          required: true,
          options: [
            { label: "Shared Login Details (Strictly 1 User / 1 Device)", value: "shared", price_delta_kobo: 0 },
            { label: "Semi-Private / Personal Login (1 User / 1 Device)", value: "personal", price_delta_kobo: 350000 },
          ],
        },
      ],
    };

    expect(hasSharedLogin(nord)).toBe(true);
    expect(isSharedOptionSelected(nord, { plan_tier: "shared" })).toEqual({
      offersShared: true,
      selectedIsShared: true,
    });
    expect(isSharedOptionSelected(nord, { plan_tier: "personal" })).toEqual({
      offersShared: true,
      selectedIsShared: false,
    });
    expect(hasServiceSharedLogin({ label: "NordVPN Shared", metadata: {}, credentials: {} })).toBe(true);
    expect(hasServiceSharedLogin({ label: "ExpressVPN Private", metadata: {}, credentials: {} })).toBe(false);
  });
});

describe("VirtualSMS Pricing & Country Matching", () => {
  it("computes Math.ceil((wholesaleUsd * rate) * (1 + markup/100) + flatFee)", () => {
    expect(
      calculateRetailPriceNaira({
        wholesaleUsd: 0.5,
        usdToNgnRate: 1600,
        markupPercent: 40,
        flatFee: 0,
      })
    ).toBe(1120);

    expect(
      calculateRetailPriceNaira({
        wholesaleUsd: 0.33,
        usdToNgnRate: 1600,
        markupPercent: 40,
        flatFee: 100,
      })
    ).toBe(Math.ceil(0.33 * 1600 * 1.4 + 100));
  });

  it("matches configured USA and UK countries against live provider IDs", () => {
    const resolved = resolveEnabledCountries(
      [
        { id: "187", name: "United States" },
        { id: "16", name: "United Kingdom" },
      ],
      [
        { id: "12", name: "USA" },
        { id: "16", name: "England" },
      ],
      ["12", "16"]
    );
    expect(resolved).toEqual([
      { id: "12", name: "USA" },
      { id: "16", name: "England" },
    ]);
  });
});
