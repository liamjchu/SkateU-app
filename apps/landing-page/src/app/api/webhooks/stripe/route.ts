import { NextResponse } from "next/server";

import { upsertPaidShopOrder } from "../../../../lib/shop-orders";
import { getStripeClient, stripeWebhookSecret } from "../../../../lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const paidCheckoutEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

function invalidSignatureResponse(): NextResponse {
  return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
}

function failureResponse(): NextResponse {
  return NextResponse.json(
    { error: "Unable to process webhook." },
    { status: 500 }
  );
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Method not allowed." },
    { status: 405, headers: { Allow: "POST" } }
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return invalidSignatureResponse();
  }

  let eventType: string;
  let sessionId: string | undefined;

  try {
    const event = getStripeClient().webhooks.constructEvent(
      await request.text(),
      signature,
      stripeWebhookSecret()
    );
    eventType = event.type;

    if (
      event.data.object &&
      typeof event.data.object === "object" &&
      "object" in event.data.object &&
      event.data.object.object === "checkout.session" &&
      "id" in event.data.object &&
      typeof event.data.object.id === "string"
    ) {
      sessionId = event.data.object.id;
    }
  } catch {
    return invalidSignatureResponse();
  }

  if (!paidCheckoutEvents.has(eventType)) {
    return NextResponse.json({ received: true });
  }

  if (!sessionId) {
    return NextResponse.json({ received: true });
  }

  try {
    await upsertPaidShopOrder(sessionId);
    return NextResponse.json({ received: true });
  } catch {
    return failureResponse();
  }
}
