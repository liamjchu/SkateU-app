// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render } from "../test/react-dom";

vi.mock("next/image", () => ({
  default: () => null,
}));

import Home from "./page";

afterEach(cleanup);

describe("Home", () => {
  it("renders the landing-page message and waitlist form", () => {
    const container = render(<Home />);
    const skipLink = container.querySelector('a[href="#main-content"]');

    expect(skipLink?.textContent).toBe("Skip to content");
    expect(container.querySelector('a[aria-label="SkateU home"]')?.getAttribute("href")).toBe("/");
    expect(container.textContent).toContain("Locals know the spots,");
    expect(container.textContent).toContain("Now you do too");
    expect(container.textContent).toContain("finding, liking, and sharing");
    expect(container.textContent).not.toContain("finding, rating, and sharing");
    expect(container.querySelector('form[aria-label="Join the SkateU waitlist"]')).not.toBeNull();
    const legalNav = container.querySelector('nav[aria-label="Legal"]');
    expect(legalNav).not.toBeNull();
    expect(legalNav?.querySelectorAll("a")).toHaveLength(1);
    const privacyLink = legalNav?.querySelector('a[href="/privacy"]');
    expect(privacyLink?.textContent).toBe("Privacy Policy");
    expect(legalNav?.querySelector('a[href="/terms"]')).toBeNull();
    expect(legalNav?.querySelector('a[href="/community-guidelines"]')).toBeNull();
    const socialLinks = [
      ["Instagram", "https://www.instagram.com/skateu.app/"],
      ["TikTok", "https://www.tiktok.com/@skateu.app?is_from_webapp=1&sender_device=pc"],
      ["YouTube", "https://www.youtube.com/@liam_chu"],
    ] as const;

    for (const [platform, href] of socialLinks) {
      const link = container.querySelector(`a[aria-label="Follow SkateU on ${platform}"]`);

      expect(link?.getAttribute("href")).toBe(href);
      expect(link?.getAttribute("target")).toBe("_blank");
      expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });
});
