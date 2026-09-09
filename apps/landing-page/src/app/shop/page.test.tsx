// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render } from "../../test/react-dom";

vi.mock("next/image", () => ({
  default: () => null,
}));

import ShopPage from "./page";

afterEach(cleanup);

describe("Shop page", () => {
  it("renders stickers as live merch and upcoming categories as coming soon", () => {
    const container = render(<ShopPage />);
    const categories = container.querySelector('nav[aria-label="Shop categories"]');

    expect(container.querySelector('header a[href="/shop"]')?.textContent).toBe("Shop");
    expect(container.querySelector("#shop-title")?.textContent).toBe("Shop");
    expect(container.textContent).toContain("Stickers first");
    expect(container.textContent).toContain("Checkout is not open yet");
    expect(container.textContent).not.toMatch(/\$/);

    expect(categories?.querySelector('[aria-current="page"]')?.textContent).toBe("Stickers");

    const comingSoon = [...(categories?.querySelectorAll("button") ?? [])];
    expect(comingSoon.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Clothing, coming soon",
      "Griptape, coming soon",
      "Boards, coming soon",
    ]);
    expect(comingSoon.every((button) => button.disabled)).toBe(true);

    const productLink = container.querySelector('a[href="/shop/skateu-sticker"]');
    expect(productLink?.textContent).toContain("SkateU Sticker");
    expect(productLink?.textContent).toContain("Coming soon");
  });
});
