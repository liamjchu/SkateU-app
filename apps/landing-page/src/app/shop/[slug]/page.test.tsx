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

vi.mock("next/navigation", () => ({
  notFound,
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
        "The SkateU logo as a sticker. Stick it on a laptop, board, or bottle. Checkout is coming soon.",
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
  it("renders the sticker with checkout disabled", async () => {
    const container = render(
      await ProductPage({ params: Promise.resolve({ slug: "skateu-sticker" }) })
    );
    const checkout = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Checkout coming soon")
    );

    expect(container.querySelector("#product-title")?.textContent).toBe("SkateU Sticker");
    expect(container.textContent).toContain("Coming soon");
    expect(container.textContent).toContain("Checkout is coming soon");
    expect(container.textContent).not.toMatch(/\$/);
    expect(
      [...container.querySelectorAll('a[href="/shop"]')].some((link) =>
        link.textContent?.includes("Back to shop")
      )
    ).toBe(true);
    expect(checkout?.disabled).toBe(true);
    expect(notFound).not.toHaveBeenCalled();
  });

  it("calls notFound when the slug is unknown", async () => {
    await expect(
      ProductPage({ params: Promise.resolve({ slug: "missing" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
