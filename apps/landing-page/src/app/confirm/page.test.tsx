// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render } from "../../test/react-dom";

vi.mock("next/image", () => ({
  default: () => null,
}));

const { confirmSubscription } = vi.hoisted(() => ({
  confirmSubscription: vi.fn(),
}));

vi.mock("../../lib/confirm-subscription", () => ({
  confirmSubscription,
  waitlistTokenFromSearchParam: (token: unknown) =>
    typeof token === "string" ? token : null,
}));

import ConfirmPage from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConfirmPage", () => {
  it("renders the confirmed waitlist message", async () => {
    confirmSubscription.mockResolvedValue(true);
    const container = render(
      await ConfirmPage({
        searchParams: Promise.resolve({
          token: "00000000-0000-4000-8000-000000000001",
        }),
      })
    );

    expect(container.textContent).toContain("Your email is confirmed.");
    expect(container.textContent).toContain("You’re on the SkateU waitlist.");
    expect(
      container.querySelector('form[aria-label="Join the SkateU waitlist"]')
    ).toBeNull();
    const backLink = [...container.querySelectorAll("a")].find((link) =>
      link.textContent?.includes("Back to SkateU")
    );
    expect(backLink?.getAttribute("href")).toBe("/");
  });

  it("lets the user request a new confirmation email when the link is invalid", async () => {
    confirmSubscription.mockResolvedValue(false);
    const container = render(
      await ConfirmPage({ searchParams: Promise.resolve({}) })
    );

    expect(container.textContent).toContain(
      "This confirmation link is invalid or expired."
    );
    expect(container.textContent).toContain("Request a new confirmation email");
    expect(
      container.querySelector('form[aria-label="Join the SkateU waitlist"]')
    ).not.toBeNull();
  });
});
