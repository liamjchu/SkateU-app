import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createShopCheckoutUrl } = vi.hoisted(() => ({
  createShopCheckoutUrl: vi.fn(),
}));

vi.mock("../../../lib/shop-checkout", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/shop-checkout")>(
    "../../../lib/shop-checkout"
  );

  return {
    ...actual,
    createShopCheckoutUrl,
  };
});

vi.mock("../../../lib/stripe", () => ({
  SHOP_CHECKOUT_INTEGRATION_IDENTIFIER: "skateu-shop-kqmwrpnd",
  SHOP_CHECKOUT_MAX_QUANTITY: 10,
  getStripeClient: vi.fn(),
  shopSiteUrl: vi.fn(),
  stripePriceId: vi.fn(),
  stripeShippingAmountCents: vi.fn(),
}));

import { GET, POST } from "./route";

function checkoutRequest(body: string, contentType = "application/x-www-form-urlencoded") {
  return new Request("https://landing.example.test/api/checkout", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  });
}

beforeEach(() => {
  createShopCheckoutUrl.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/checkout", () => {
  it("rejects reads", async () => {
    const response = await GET();

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });
});

describe("POST /api/checkout", () => {
  it("rejects a missing slug without creating a session", async () => {
    const response = await POST(checkoutRequest(""));

    expect(response.status).toBe(400);
    expect(createShopCheckoutUrl).not.toHaveBeenCalled();
  });

  it("rejects an unknown product", async () => {
    createShopCheckoutUrl.mockResolvedValue(null);

    const response = await POST(checkoutRequest("slug=missing"));

    expect(response.status).toBe(400);
    expect(createShopCheckoutUrl).toHaveBeenCalledWith("missing");
  });

  it("redirects to the hosted Checkout URL", async () => {
    createShopCheckoutUrl.mockResolvedValue(
      "https://checkout.stripe.com/c/pay/cs_test"
    );

    const response = await POST(checkoutRequest("slug=skateu-sticker"));

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "https://checkout.stripe.com/c/pay/cs_test"
    );
  });

  it("returns a generic error when Stripe fails", async () => {
    createShopCheckoutUrl.mockRejectedValue(new Error("Stripe unavailable"));

    const response = await POST(checkoutRequest("slug=skateu-sticker"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Unable to start checkout.",
    });
  });
});
