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
    expect(container.textContent).toContain("Locals know the spots,");
    expect(container.textContent).toContain("Now you do too");
    expect(container.querySelector('form[aria-label="Join the SkateU waitlist"]')).not.toBeNull();
    expect(container.textContent).toContain("Find a new campus skate spot");
  });
});
