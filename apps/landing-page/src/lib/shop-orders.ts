import type Stripe from "stripe";

import { getSupabaseAdmin } from "./supabase-server";
import { checkoutSessionIsPaid } from "./shop-checkout";
import { getStripeClient } from "./stripe";

export type ShopOrderRecord = {
  session_id: string;
  email: string | null;
  product_slug: string;
  quantity: number;
  amount_total: number | null;
  currency: string;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  shipping_name: string | null;
  shipping_line1: string | null;
  shipping_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
};

export function shopOrderFromSession(
  session: Stripe.Checkout.Session
): ShopOrderRecord | null {
  const productSlug = session.metadata?.product_slug?.trim();

  if (!productSlug) {
    return null;
  }

  const shipping = session.collected_information?.shipping_details;
  const quantity = session.line_items?.data[0]?.quantity;

  return {
    session_id: session.id,
    email: session.customer_details?.email ?? session.customer_email,
    product_slug: productSlug,
    quantity: typeof quantity === "number" && quantity >= 1 ? quantity : 1,
    amount_total: session.amount_total,
    currency: session.currency ?? "usd",
    payment_status:
      session.payment_status === "no_payment_required"
        ? "no_payment_required"
        : session.payment_status === "paid"
          ? "paid"
          : "unpaid",
    shipping_name: shipping?.name ?? null,
    shipping_line1: shipping?.address.line1 ?? null,
    shipping_line2: shipping?.address.line2 ?? null,
    shipping_city: shipping?.address.city ?? null,
    shipping_state: shipping?.address.state ?? null,
    shipping_postal_code: shipping?.address.postal_code ?? null,
    shipping_country: shipping?.address.country ?? null,
  };
}

export async function upsertPaidShopOrder(
  sessionId: string
): Promise<"ignored" | "saved"> {
  const session = await getStripeClient().checkout.sessions.retrieve(sessionId, {
    expand: ["line_items"],
  });

  if (!checkoutSessionIsPaid(session.payment_status)) {
    return "ignored";
  }

  const order = shopOrderFromSession(session);

  if (!order) {
    return "ignored";
  }

  const { error } = await getSupabaseAdmin()
    .from("shop_orders")
    .upsert(order, { onConflict: "session_id" });

  if (error) {
    throw new Error("Unable to save shop order.");
  }

  return "saved";
}
