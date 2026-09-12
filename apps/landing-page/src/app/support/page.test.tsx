// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render } from "../../test/react-dom";

vi.mock("next/image", () => ({
  default: () => null,
}));

import SupportPage from "./page";

afterEach(cleanup);

describe("Support page", () => {
  it("renders a contact email", () => {
    const container = render(<SupportPage />);
    expect(container.textContent).toContain("Support");
    expect(
      container.querySelector('a[href="mailto:support@skateu.app"]')?.textContent
    ).toBe("support@skateu.app");
    expect(container.firstElementChild?.className).toContain("min-h-screen");
    expect(container.firstElementChild?.className).toContain("flex-col");
  });
});
