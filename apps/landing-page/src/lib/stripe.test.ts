import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getStripeClient,
  shopSiteUrl,
  stripePriceId,
  stripeShippingAmountCents,
  stripeWebhookSecret,
} from "./stripe";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("stripe environment helpers", () => {
  it("reads the webhook secret, price id, site origin, and free shipping default", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    vi.stubEnv("STRIPE_PRICE_ID", "price_123");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://skateu.app/");
    vi.stubEnv("STRIPE_SHIPPING_AMOUNT_CENTS", "");

    expect(stripeWebhookSecret()).toBe("whsec_test");
    expect(stripePriceId()).toBe("price_123");
    expect(shopSiteUrl()).toBe("https://skateu.app");
    expect(stripeShippingAmountCents()).toBe(0);
  });

  it("parses a shipping amount in cents", () => {
    vi.stubEnv("STRIPE_SHIPPING_AMOUNT_CENTS", "495");

    expect(stripeShippingAmountCents()).toBe(495);
  });

  it("rejects a non-integer shipping amount", () => {
    vi.stubEnv("STRIPE_SHIPPING_AMOUNT_CENTS", "-1");

    expect(() => stripeShippingAmountCents()).toThrow(
      "STRIPE_SHIPPING_AMOUNT_CENTS must be a non-negative integer."
    );
  });

  it("rejects a non-http site URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "ftp://skateu.app");

    expect(() => shopSiteUrl()).toThrow(
      "NEXT_PUBLIC_SITE_URL must be an http or https origin."
    );
  });

  it("requires a Stripe restricted key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");

    expect(() => getStripeClient()).toThrow(
      "Missing required environment variable: STRIPE_SECRET_KEY"
    );
  });

  it("creates a Stripe client from the restricted key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_placeholder");

    expect(getStripeClient()).toBe(getStripeClient());
  });
});
