import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

const { upsertPaidShopOrder } = vi.hoisted(() => ({
  upsertPaidShopOrder: vi.fn(),
}));
const { getStripeClient, stripeWebhookSecret } = vi.hoisted(() => ({
  getStripeClient: vi.fn(),
  stripeWebhookSecret: vi.fn(),
}));

vi.mock("../../../../lib/shop-orders", () => ({ upsertPaidShopOrder }));
vi.mock("../../../../lib/stripe", () => ({
  getStripeClient,
  stripeWebhookSecret,
}));

import { GET, POST } from "./route";

const webhookSecret = "whsec_test_secret";
const signer = new Stripe("sk_test_placeholder", {
  apiVersion: "2026-08-26.dahlia",
});

function signedRequest(
  event: Record<string, unknown>,
  secret = webhookSecret
): Request {
  const payload = JSON.stringify(event);
  const signature = signer.webhooks.generateTestHeaderString({
    payload,
    secret,
  });

  return new Request("https://landing.example.test/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: payload,
  });
}

function checkoutEvent(
  type: string,
  session: Record<string, unknown> = { id: "cs_test_1", object: "checkout.session" }
) {
  return {
    id: "evt_test_1",
    object: "event",
    type,
    data: { object: session },
  };
}

beforeEach(() => {
  upsertPaidShopOrder.mockReset();
  stripeWebhookSecret.mockReturnValue(webhookSecret);
  getStripeClient.mockReturnValue({
    webhooks: {
      constructEvent: (
        payload: string,
        header: string,
        secret: string
      ) => signer.webhooks.constructEvent(payload, header, secret),
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/webhooks/stripe", () => {
  it("rejects reads", async () => {
    const response = await GET();

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });
});

describe("POST /api/webhooks/stripe", () => {
  it("rejects a missing signature", async () => {
    const response = await POST(
      new Request("https://landing.example.test/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
      })
    );

    expect(response.status).toBe(400);
    expect(upsertPaidShopOrder).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature", async () => {
    const response = await POST(
      signedRequest(checkoutEvent("checkout.session.completed"), "whsec_other")
    );

    expect(response.status).toBe(400);
    expect(upsertPaidShopOrder).not.toHaveBeenCalled();
  });

  it("acknowledges unrelated events", async () => {
    const response = await POST(signedRequest(checkoutEvent("ping")));

    expect(response.status).toBe(200);
    expect(upsertPaidShopOrder).not.toHaveBeenCalled();
  });

  it("fulfills a paid checkout.session.completed event", async () => {
    upsertPaidShopOrder.mockResolvedValue("saved");

    const response = await POST(
      signedRequest(checkoutEvent("checkout.session.completed"))
    );

    expect(response.status).toBe(200);
    expect(upsertPaidShopOrder).toHaveBeenCalledWith("cs_test_1");
  });

  it("fulfills checkout.session.async_payment_succeeded", async () => {
    upsertPaidShopOrder.mockResolvedValue("saved");

    const response = await POST(
      signedRequest(checkoutEvent("checkout.session.async_payment_succeeded"))
    );

    expect(response.status).toBe(200);
    expect(upsertPaidShopOrder).toHaveBeenCalledWith("cs_test_1");
  });

  it("does not fulfill checkout.session.async_payment_failed", async () => {
    const response = await POST(
      signedRequest(checkoutEvent("checkout.session.async_payment_failed"))
    );

    expect(response.status).toBe(200);
    expect(upsertPaidShopOrder).not.toHaveBeenCalled();
  });

  it("acknowledges paid events without a session id", async () => {
    const response = await POST(
      signedRequest(
        checkoutEvent("checkout.session.completed", { object: "checkout.session" })
      )
    );

    expect(response.status).toBe(200);
    expect(upsertPaidShopOrder).not.toHaveBeenCalled();
  });

  it("returns a server error when fulfillment fails", async () => {
    upsertPaidShopOrder.mockRejectedValue(new Error("Database unavailable"));

    const response = await POST(
      signedRequest(checkoutEvent("checkout.session.completed"))
    );

    expect(response.status).toBe(500);
  });
});
