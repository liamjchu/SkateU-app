import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getStripeClient, stripePriceId } = vi.hoisted(() => ({
  getStripeClient: vi.fn(),
  stripePriceId: vi.fn(),
}));

vi.mock("./stripe", () => ({
  getStripeClient,
  stripePriceId,
}));

import { formatStripeAmount, getProductPriceDisplay } from "./shop-price";

afterEach(() => {
  vi.clearAllMocks();
});

describe("formatStripeAmount", () => {
  it("formats USD cents", () => {
    expect(formatStripeAmount(500, "usd")).toBe("$5.00");
  });
});

describe("getProductPriceDisplay", () => {
  const retrieve = vi.fn();

  beforeEach(() => {
    retrieve.mockReset();
    getStripeClient.mockReturnValue({ prices: { retrieve } });
    stripePriceId.mockReturnValue("price_123");
  });

  it("returns a formatted Stripe price", async () => {
    retrieve.mockResolvedValue({ unit_amount: 500, currency: "usd" });

    await expect(getProductPriceDisplay()).resolves.toBe("$5.00");
    expect(retrieve).toHaveBeenCalledWith("price_123");
  });

  it("returns null when the price has no unit amount", async () => {
    retrieve.mockResolvedValue({ unit_amount: null, currency: "usd" });

    await expect(getProductPriceDisplay()).resolves.toBeNull();
  });

  it("returns null when Stripe is unavailable", async () => {
    retrieve.mockRejectedValue(new Error("Stripe unavailable"));

    await expect(getProductPriceDisplay()).resolves.toBeNull();
  });
});
