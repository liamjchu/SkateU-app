// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render } from "../../test/react-dom";

vi.mock("next/image", () => ({
  default: () => null,
}));

import TermsPage from "./page";

afterEach(cleanup);

describe("Terms page", () => {
  it("renders the Terms of Use", () => {
    const container = render(<TermsPage />);
    expect(container.textContent).toContain("Terms of Use");
    expect(container.textContent).toContain("13 years old");
    expect(container.querySelector('a[href="/terms"]')?.textContent).toBe(
      "Terms of Use"
    );
  });
});
