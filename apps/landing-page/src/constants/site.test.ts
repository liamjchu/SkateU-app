import { describe, expect, it } from "vitest";

import {
  DEFAULT_TESTFLIGHT_JOIN_URL,
  SITE_DESCRIPTION,
  SITE_TITLE,
  testFlightJoinUrl,
} from "./site";

describe("site copy", () => {
  it("uses the landing-page title", () => {
    expect(SITE_TITLE).toBe("SkateU — Every school is a skatepark.");
    expect(SITE_DESCRIPTION).toContain("campus");
    expect(SITE_DESCRIPTION).toContain("beta");
    expect(SITE_TITLE).not.toContain("Land tricks");
  });
});

describe("testFlightJoinUrl", () => {
  it("accepts a public TestFlight join URL", () => {
    expect(testFlightJoinUrl("https://testflight.apple.com/join/AbC123")).toBe(
      "https://testflight.apple.com/join/AbC123"
    );
  });

  it("uses the public SkateU join URL when none is provided", () => {
    expect(testFlightJoinUrl(undefined)).toBe(DEFAULT_TESTFLIGHT_JOIN_URL);
    expect(testFlightJoinUrl("")).toBe(DEFAULT_TESTFLIGHT_JOIN_URL);
  });

  it("rejects non-TestFlight URLs", () => {
    expect(testFlightJoinUrl("https://example.test/join/AbC123")).toBeNull();
    expect(testFlightJoinUrl("http://testflight.apple.com/join/AbC123")).toBeNull();
  });
});
