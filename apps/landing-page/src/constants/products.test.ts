import { describe, expect, it } from "vitest";

import {
  productBySlug,
  PRODUCTS,
  productsInCategory,
  SHOP_CATEGORIES,
} from "./products";

describe("shop catalog", () => {
  it("lists stickers as live and the rest as coming soon", () => {
    expect(SHOP_CATEGORIES).toEqual([
      { id: "stickers", label: "Stickers", status: "live" },
      { id: "clothing", label: "Clothing", status: "coming_soon" },
      { id: "griptape", label: "Griptape", status: "coming_soon" },
      { id: "boards", label: "Boards", status: "coming_soon" },
    ]);
  });

  it("has one coming-soon sticker and no prices", () => {
    expect(PRODUCTS).toHaveLength(1);
    expect(PRODUCTS[0]).toMatchObject({
      slug: "skateu-sticker",
      name: "SkateU Sticker",
      category: "stickers",
      status: "coming_soon",
    });
    expect(JSON.stringify(PRODUCTS)).not.toMatch(/\$/);
  });
});

describe("productBySlug", () => {
  it("returns the sticker by slug", () => {
    expect(productBySlug("skateu-sticker")?.name).toBe("SkateU Sticker");
  });

  it("returns undefined when the slug is missing", () => {
    expect(productBySlug("missing")).toBeUndefined();
    expect(productBySlug("")).toBeUndefined();
  });
});

describe("productsInCategory", () => {
  it("returns sticker products", () => {
    expect(productsInCategory("stickers").map((product) => product.slug)).toEqual([
      "skateu-sticker",
    ]);
  });

  it("returns no products for upcoming categories", () => {
    expect(productsInCategory("clothing")).toEqual([]);
    expect(productsInCategory("griptape")).toEqual([]);
    expect(productsInCategory("boards")).toEqual([]);
  });
});
