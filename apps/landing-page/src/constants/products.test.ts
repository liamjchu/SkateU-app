import { describe, expect, it } from "vitest";

import {
  liveProductBySlug,
  PRODUCTS,
  productBySlug,
  productsInCategory,
  SHOP_CATEGORIES,
  STICKER_SLUG,
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

  it("has one live sticker without a hardcoded dollar amount", () => {
    expect(PRODUCTS).toHaveLength(1);
    expect(PRODUCTS[0]).toMatchObject({
      slug: STICKER_SLUG,
      name: "SkateU Sticker",
      category: "stickers",
      status: "live",
    });
    expect(JSON.stringify(PRODUCTS)).not.toMatch(/\$/);
  });
});

describe("productBySlug", () => {
  it("returns the sticker by slug", () => {
    expect(productBySlug(STICKER_SLUG)?.name).toBe("SkateU Sticker");
  });

  it("returns undefined when the slug is missing", () => {
    expect(productBySlug("missing")).toBeUndefined();
    expect(productBySlug("")).toBeUndefined();
  });
});

describe("liveProductBySlug", () => {
  it("returns the live sticker", () => {
    expect(liveProductBySlug(STICKER_SLUG)?.status).toBe("live");
  });

  it("returns null when the slug is unknown", () => {
    expect(liveProductBySlug("missing")).toBeNull();
  });
});

describe("productsInCategory", () => {
  it("returns sticker products", () => {
    expect(productsInCategory("stickers").map((product) => product.slug)).toEqual([
      STICKER_SLUG,
    ]);
  });

  it("returns no products for upcoming categories", () => {
    expect(productsInCategory("clothing")).toEqual([]);
    expect(productsInCategory("griptape")).toEqual([]);
    expect(productsInCategory("boards")).toEqual([]);
  });
});
