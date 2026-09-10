import type Stripe from "stripe";

import { liveProductBySlug } from "../constants/products";
import {
  SHOP_CHECKOUT_INTEGRATION_IDENTIFIER,
  SHOP_CHECKOUT_MAX_QUANTITY,
  getStripeClient,
  shopSiteUrl,
  stripePriceId,
  stripeShippingAmountCents,
} from "./stripe";

export function checkoutSlugFromFormData(formData: FormData): string | null {
  const slug = formData.get("slug");

  return typeof slug === "string" && slug.trim().length > 0 ? slug.trim() : null;
}

export function checkoutSessionIsPaid(
  paymentStatus: Stripe.Checkout.Session.PaymentStatus
): boolean {
  return paymentStatus !== "unpaid";
}

export function shopCheckoutSessionParams(input: {
  priceId: string;
  slug: string;
  siteUrl: string;
  shippingAmountCents: number;
}): Stripe.Checkout.SessionCreateParams {
  const shippingLabel =
    input.shippingAmountCents === 0 ? "Free shipping" : "USPS First Class";

  return {
    mode: "payment",
    integration_identifier: SHOP_CHECKOUT_INTEGRATION_IDENTIFIER,
    origin_context: "web",
    submit_type: "pay",
    line_items: [
      {
        price: input.priceId,
        quantity: 1,
        adjustable_quantity: {
          enabled: true,
          minimum: 1,
          maximum: SHOP_CHECKOUT_MAX_QUANTITY,
        },
      },
    ],
    success_url: `${input.siteUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.siteUrl}/shop/${input.slug}`,
    shipping_address_collection: {
      allowed_countries: ["US"],
    },
    shipping_options: [
      {
        shipping_rate_data: {
          display_name: shippingLabel,
          type: "fixed_amount",
          fixed_amount: {
            amount: input.shippingAmountCents,
            currency: "usd",
          },
        },
      },
    ],
    metadata: {
      product_slug: input.slug,
    },
  };
}

export async function createShopCheckoutUrl(slug: string): Promise<string | null> {
  const product = liveProductBySlug(slug);

  if (!product) {
    return null;
  }

  const session = await getStripeClient().checkout.sessions.create(
    shopCheckoutSessionParams({
      priceId: stripePriceId(),
      slug: product.slug,
      siteUrl: shopSiteUrl(),
      shippingAmountCents: stripeShippingAmountCents(),
    })
  );

  if (!session.url) {
    throw new Error("Checkout session is missing a hosted URL.");
  }

  return session.url;
}
