import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
const { getStripeClient } = vi.hoisted(() => ({ getStripeClient: vi.fn() }));

vi.mock("./supabase-server", () => ({ getSupabaseAdmin }));
vi.mock("./stripe", () => ({ getStripeClient }));

import { shopOrderFromSession, upsertPaidShopOrder } from "./shop-orders";

function paidSession(
  overrides: Partial<Stripe.Checkout.Session> = {}
): Stripe.Checkout.Session {
  return {
    id: "cs_test_1",
    object: "checkout.session",
    payment_status: "paid",
    amount_total: 500,
    currency: "usd",
    customer_details: { email: "skater@example.test" },
    customer_email: null,
    metadata: { product_slug: "skateu-sticker" },
    collected_information: {
      shipping_details: {
        name: "Skater U",
        address: {
          line1: "1 Campus Dr",
          line2: null,
          city: "Austin",
          state: "TX",
          postal_code: "78701",
          country: "US",
        },
      },
    },
    line_items: {
      object: "list",
      data: [{ quantity: 2 }],
    },
    ...overrides,
  } as Stripe.Checkout.Session;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("shopOrderFromSession", () => {
  it("maps shipping and quantity from a paid session", () => {
    expect(shopOrderFromSession(paidSession())).toMatchObject({
      session_id: "cs_test_1",
      email: "skater@example.test",
      product_slug: "skateu-sticker",
      quantity: 2,
      amount_total: 500,
      currency: "usd",
      payment_status: "paid",
      shipping_name: "Skater U",
      shipping_line1: "1 Campus Dr",
      shipping_city: "Austin",
      shipping_state: "TX",
      shipping_postal_code: "78701",
      shipping_country: "US",
    });
  });

  it("returns null without a product slug", () => {
    expect(
      shopOrderFromSession(paidSession({ metadata: {} }))
    ).toBeNull();
  });

  it("falls back to customer email, quantity 1, and empty shipping", () => {
    expect(
      shopOrderFromSession({
        ...paidSession(),
        customer_details: null,
        customer_email: "guest@example.test",
        currency: null,
        line_items: { object: "list", data: [] },
        collected_information: null,
      } as unknown as Stripe.Checkout.Session)
    ).toMatchObject({
      email: "guest@example.test",
      quantity: 1,
      currency: "usd",
      shipping_name: null,
      shipping_line1: null,
    });
  });
});

describe("upsertPaidShopOrder", () => {
  const retrieve = vi.fn();
  const upsert = vi.fn();

  beforeEach(() => {
    retrieve.mockReset();
    upsert.mockReset();
    getStripeClient.mockReturnValue({
      checkout: { sessions: { retrieve } },
    });
    getSupabaseAdmin.mockReturnValue({
      from: () => ({ upsert }),
    });
  });

  it("ignores unpaid sessions", async () => {
    retrieve.mockResolvedValue(paidSession({ payment_status: "unpaid" }));

    await expect(upsertPaidShopOrder("cs_test_1")).resolves.toBe("ignored");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("ignores paid sessions without a product slug", async () => {
    retrieve.mockResolvedValue(paidSession({ metadata: {} }));

    await expect(upsertPaidShopOrder("cs_test_1")).resolves.toBe("ignored");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts a paid session by session id", async () => {
    retrieve.mockResolvedValue(paidSession());
    upsert.mockResolvedValue({ error: null });

    await expect(upsertPaidShopOrder("cs_test_1")).resolves.toBe("saved");
    expect(retrieve).toHaveBeenCalledWith("cs_test_1", {
      expand: ["line_items"],
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: "cs_test_1",
        product_slug: "skateu-sticker",
        payment_status: "paid",
      }),
      { onConflict: "session_id" }
    );
  });

  it("throws when Supabase rejects the upsert", async () => {
    retrieve.mockResolvedValue(paidSession());
    upsert.mockResolvedValue({ error: { message: "write failed" } });

    await expect(upsertPaidShopOrder("cs_test_1")).rejects.toThrow(
      "Unable to save shop order."
    );
  });
});
