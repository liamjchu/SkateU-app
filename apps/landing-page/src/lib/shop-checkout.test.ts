import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getStripeClient,
  shopSiteUrl,
  stripePriceId,
  stripeShippingAmountCents,
} = vi.hoisted(() => ({
  getStripeClient: vi.fn(),
  shopSiteUrl: vi.fn(),
  stripePriceId: vi.fn(),
  stripeShippingAmountCents: vi.fn(),
}));

vi.mock("./stripe", () => ({
  SHOP_CHECKOUT_INTEGRATION_IDENTIFIER: "skateu-shop-kqmwrpnd",
  SHOP_CHECKOUT_MAX_QUANTITY: 10,
  getStripeClient,
  shopSiteUrl,
  stripePriceId,
  stripeShippingAmountCents,
}));

import {
  checkoutSessionIsPaid,
  checkoutSlugFromFormData,
  createShopCheckoutUrl,
  shopCheckoutSessionParams,
} from "./shop-checkout";

afterEach(() => {
  vi.clearAllMocks();
});

describe("checkoutSlugFromFormData", () => {
  it("reads a trimmed slug", () => {
    const formData = new FormData();
    formData.set("slug", "  skateu-sticker  ");

    expect(checkoutSlugFromFormData(formData)).toBe("skateu-sticker");
  });

  it("rejects missing slugs", () => {
    expect(checkoutSlugFromFormData(new FormData())).toBeNull();
  });
});

describe("checkoutSessionIsPaid", () => {
  it("treats paid and no_payment_required as paid", () => {
    expect(checkoutSessionIsPaid("paid")).toBe(true);
    expect(checkoutSessionIsPaid("no_payment_required")).toBe(true);
    expect(checkoutSessionIsPaid("unpaid")).toBe(false);
  });
});

describe("shopCheckoutSessionParams", () => {
  it("builds a hosted US checkout session without hardcoding payment methods", () => {
    const params = shopCheckoutSessionParams({
      priceId: "price_123",
      slug: "skateu-sticker",
      siteUrl: "https://skateu.app",
      shippingAmountCents: 0,
    });

    expect(params).toMatchObject({
      mode: "payment",
      integration_identifier: "skateu-shop-kqmwrpnd",
      success_url:
        "https://skateu.app/shop/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://skateu.app/shop/skateu-sticker",
      shipping_address_collection: { allowed_countries: ["US"] },
      metadata: { product_slug: "skateu-sticker" },
    });
    expect(params).not.toHaveProperty("payment_method_types");
    expect(params.line_items?.[0]).toMatchObject({
      price: "price_123",
      quantity: 1,
      adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 },
    });
    expect(params.shipping_options?.[0]?.shipping_rate_data).toMatchObject({
      display_name: "Free shipping",
      type: "fixed_amount",
      fixed_amount: { amount: 0, currency: "usd" },
    });
  });

  it("labels paid shipping", () => {
    const params = shopCheckoutSessionParams({
      priceId: "price_123",
      slug: "skateu-sticker",
      siteUrl: "https://skateu.app",
      shippingAmountCents: 495,
    });

    expect(params.shipping_options?.[0]?.shipping_rate_data).toMatchObject({
      display_name: "USPS First Class",
      fixed_amount: { amount: 495, currency: "usd" },
    });
  });
});

describe("createShopCheckoutUrl", () => {
  const create = vi.fn();

  beforeEach(() => {
    create.mockReset();
    getStripeClient.mockReturnValue({
      checkout: { sessions: { create } },
    });
    shopSiteUrl.mockReturnValue("https://skateu.app");
    stripePriceId.mockReturnValue("price_123");
    stripeShippingAmountCents.mockReturnValue(0);
  });

  it("returns null for an unknown product without calling Stripe", async () => {
    await expect(createShopCheckoutUrl("missing")).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a hosted session for the live sticker", async () => {
    create.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_test" });

    await expect(createShopCheckoutUrl("skateu-sticker")).resolves.toBe(
      "https://checkout.stripe.com/c/pay/cs_test"
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        metadata: { product_slug: "skateu-sticker" },
      })
    );
  });

  it("throws when Stripe omits the hosted URL", async () => {
    create.mockResolvedValue({ url: null });

    await expect(createShopCheckoutUrl("skateu-sticker")).rejects.toThrow(
      "Checkout session is missing a hosted URL."
    );
  });
});
