// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render } from "../test/react-dom";

vi.mock("next/image", () => ({
  default: () => null,
}));

import Home from "./page";

afterEach(cleanup);

describe("Home", () => {
  it("renders the landing-page message and beta access paths", () => {
    const container = render(<Home />);
    const skipLink = container.querySelector('a[href="#main-content"]');

    expect(skipLink?.textContent).toBe("Skip to content");
    expect(container.querySelector('a[aria-label="SkateU home"]')?.getAttribute("href")).toBe("/");
    expect(container.textContent).toContain("Locals know the spots,");
    expect(container.textContent).toContain("Now you do too");
    expect(container.textContent).toContain("finding, liking, and sharing");
    expect(container.textContent).not.toContain("finding, rating, and sharing");
    expect(container.textContent).toContain("Beta is open");
    expect(container.textContent).toContain("Install with TestFlight");
    expect(container.textContent).toContain("Send your Play email");
    expect(
      container.querySelector('a[href="https://testflight.apple.com/join/GPHRqSmN"]')
        ?.textContent
    ).toContain("Get the iOS beta");
    expect(
      container.querySelector('form[aria-label="Request Android beta access"]')
    ).not.toBeNull();
    const legalNav = container.querySelector('nav[aria-label="Legal"]');
    expect(legalNav).not.toBeNull();
    expect(legalNav?.querySelectorAll("a")).toHaveLength(1);
    const privacyLink = legalNav?.querySelector('a[href="/privacy"]');
    expect(privacyLink?.textContent).toBe("Privacy Policy");
    expect(legalNav?.querySelector('a[href="/terms"]')).toBeNull();
    expect(legalNav?.querySelector('a[href="/community-guidelines"]')).toBeNull();
    const socialLinks = [
      ["Instagram", "https://www.instagram.com/skateuapp/"],
      ["TikTok", "https://www.tiktok.com/@skateuapp"],
      ["YouTube", "https://www.youtube.com/@skateuapp"],
    ] as const;

    for (const [platform, href] of socialLinks) {
      const link = container.querySelector(`a[aria-label="Follow SkateU on ${platform}"]`);

      expect(link?.getAttribute("href")).toBe(href);
      expect(link?.getAttribute("target")).toBe("_blank");
      expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });
});
