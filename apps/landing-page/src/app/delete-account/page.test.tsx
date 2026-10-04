// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render } from "../../test/react-dom";

vi.mock("next/image", () => ({
  default: () => null,
}));

import DeleteAccountPage from "./page";

afterEach(cleanup);

describe("Delete account page", () => {
  it("explains how to request account and data deletion", () => {
    const container = render(<DeleteAccountPage />);
    expect(container.textContent).toContain("Delete your SkateU account");
    expect(container.textContent).toContain("How to request deletion");
    expect(container.textContent).toContain("What we delete");
    expect(container.textContent).toContain("What we keep");
    expect(
      container.querySelector('a[href="mailto:support@skateu.app"]')?.textContent
    ).toBe("support@skateu.app");
    expect(container.querySelector('a[href="/privacy"]')?.textContent).toBe(
      "Privacy Policy"
    );
    expect(container.firstElementChild?.className).toContain("min-h-screen");
    expect(container.firstElementChild?.className).toContain("flex-col");
  });
});
