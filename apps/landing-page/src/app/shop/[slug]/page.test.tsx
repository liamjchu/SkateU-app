// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render } from "../../../test/react-dom";

vi.mock("next/image", () => ({
  default: () => null,
}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const { getProductPriceDisplay } = vi.hoisted(() => ({
  getProductPriceDisplay: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound,
}));

vi.mock("../../../lib/shop-price", () => ({
  getProductPriceDisplay,
}));

import ProductPage, { generateMetadata, generateStaticParams } from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("generateStaticParams", () => {
  it("builds params for the sticker", () => {
    expect(generateStaticParams()).toEqual([{ slug: "skateu-sticker" }]);
  });
});

describe("generateMetadata", () => {
  it("uses the product name and description", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "skateu-sticker" }) })
    ).resolves.toEqual({
      title: "SkateU Sticker — SkateU",
      description:
        "The SkateU logo as a sticker. Stick it on a laptop, board, or bottle.",
    });
  });

  it("falls back to the shop title when the slug is missing", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "missing" }) })
    ).resolves.toEqual({
      title: "Shop — SkateU",
    });
  });
});

describe("Product page", () => {
  it("renders the sticker as coming soon without a buy button", async () => {
    const container = render(
      await ProductPage({ params: Promise.resolve({ slug: "skateu-sticker" }) })
    );
    const checkout = container.querySelector("button");

    expect(container.querySelector("#product-title")?.textContent).toBe("SkateU Sticker");
    expect(container.textContent).toContain("Coming soon");
    expect(container.textContent).not.toContain("Available now");
    expect(container.textContent).not.toContain("Buy now");
    expect(container.textContent).not.toMatch(/\$/);
    expect(
      [...container.querySelectorAll('a[href="/shop"]')].some((link) =>
        link.textContent?.includes("Back to shop")
      )
    ).toBe(true);
    expect(container.querySelector('form[action="/api/checkout"]')).toBeNull();
    expect(checkout).toBeInstanceOf(HTMLButtonElement);
    expect(checkout?.textContent).toBe("Checkout coming soon");
    expect(checkout instanceof HTMLButtonElement && checkout.disabled).toBe(true);
    expect(getProductPriceDisplay).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("calls notFound when the slug is unknown", async () => {
    await expect(
      ProductPage({ params: Promise.resolve({ slug: "missing" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(getProductPriceDisplay).not.toHaveBeenCalled();
  });
});
