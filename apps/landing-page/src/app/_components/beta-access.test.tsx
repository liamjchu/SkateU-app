// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render } from "../../test/react-dom";
import { BetaAccess } from "./beta-access";

vi.mock("next/image", () => ({
  default: () => null,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("BetaAccess", () => {
  it("links to TestFlight when a join URL is configured", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_TESTFLIGHT_URL",
      "https://testflight.apple.com/join/AbC123"
    );
    const container = render(<BetaAccess />);
    const link = [...container.querySelectorAll("a")].find((item) =>
      item.textContent?.includes("Get the iOS beta")
    );

    expect(link?.getAttribute("href")).toBe(
      "https://testflight.apple.com/join/AbC123"
    );
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("explains when the TestFlight link is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_TESTFLIGHT_URL", "https://example.test/join/AbC123");
    const container = render(<BetaAccess />);

    expect(container.textContent).toContain(
      "The TestFlight link is not on this site yet"
    );
    expect(
      [...container.querySelectorAll("a")].some((item) =>
        item.textContent?.includes("Get the iOS beta")
      )
    ).toBe(false);
  });
});
