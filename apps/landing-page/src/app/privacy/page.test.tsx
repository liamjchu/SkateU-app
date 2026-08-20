// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render } from "../../test/react-dom";

vi.mock("next/image", () => ({
  default: () => null,
}));

import PrivacyPage from "./page";

afterEach(cleanup);

describe("Privacy page", () => {
  it("renders the Privacy Policy", () => {
    const container = render(<PrivacyPage />);
    expect(container.textContent).toContain("Privacy Policy");
    expect(container.textContent).toContain("GPS location");
    expect(container.querySelector('a[href="/privacy"]')?.textContent).toBe(
      "Privacy Policy"
    );
  });
});
