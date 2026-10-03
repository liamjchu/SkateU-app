// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render } from "../../test/react-dom";
import { AppCta } from "./app-cta";

vi.mock("next/image", () => ({
  default: () => null,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("AppCta", () => {
  it("links to the iOS beta", () => {
    const container = render(<AppCta />);
    const link = container.querySelector('a[href="https://testflight.apple.com/join/GPHRqSmN"]');

    expect(container.textContent).toContain("Get SkateU on your phone");
    expect(link?.textContent).toContain("Get the iOS beta");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(container.querySelector('form[aria-label="Request Android beta access"]')).not.toBeNull();
  });

  it("explains when the TestFlight link is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_TESTFLIGHT_URL", "https://example.test/not-testflight");
    const container = render(<AppCta />);

    expect(container.textContent).toContain("The TestFlight link is not on this site yet");
  });
});
