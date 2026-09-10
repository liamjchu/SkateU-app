// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render } from "../../../test/react-dom";

vi.mock("next/image", () => ({
  default: () => null,
}));

import ShopSuccessPage from "./page";

afterEach(cleanup);

describe("Shop success page", () => {
  it("thanks the buyer without treating the page as fulfillment", () => {
    const container = render(<ShopSuccessPage />);

    expect(container.querySelector("#success-title")?.textContent).toBe(
      "Thanks — your order is in."
    );
    expect(container.textContent).toContain("Check your email for a receipt");
    expect(
      [...container.querySelectorAll('a[href="/shop"]')].some((link) =>
        link.textContent?.includes("Back to shop")
      )
    ).toBe(true);
  });
});
