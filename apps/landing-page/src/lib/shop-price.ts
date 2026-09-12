import { stripePriceId, getStripeClient } from "./stripe";

export function formatStripeAmount(
  unitAmount: number,
  currency: string
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(unitAmount / 100);
}

export async function getProductPriceDisplay(): Promise<string | null> {
  try {
    const price = await getStripeClient().prices.retrieve(stripePriceId());

    if (typeof price.unit_amount !== "number" || !price.currency) {
      return null;
    }

    return formatStripeAmount(price.unit_amount, price.currency);
  } catch {
    return null;
  }
}
