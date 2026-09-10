import "server-only";

import Stripe from "stripe";

export const STRIPE_API_VERSION = "2026-08-26.dahlia";
export const SHOP_CHECKOUT_INTEGRATION_IDENTIFIER = "skateu-shop-kqmwrpnd";
export const SHOP_CHECKOUT_MAX_QUANTITY = 10;

let stripeClient: Stripe | null = null;

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(requiredEnvironmentValue("STRIPE_SECRET_KEY"), {
      apiVersion: STRIPE_API_VERSION,
    });
  }

  return stripeClient;
}

export function stripeWebhookSecret(): string {
  return requiredEnvironmentValue("STRIPE_WEBHOOK_SECRET");
}

export function stripePriceId(): string {
  return requiredEnvironmentValue("STRIPE_PRICE_ID");
}

export function shopSiteUrl(): string {
  const url = new URL(requiredEnvironmentValue("NEXT_PUBLIC_SITE_URL"));

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an http or https origin.");
  }

  return url.origin;
}

export function stripeShippingAmountCents(): number {
  const raw = process.env.STRIPE_SHIPPING_AMOUNT_CENTS?.trim();

  if (!raw) {
    return 0;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(
      "STRIPE_SHIPPING_AMOUNT_CENTS must be a non-negative integer."
    );
  }

  return Number.parseInt(raw, 10);
}
