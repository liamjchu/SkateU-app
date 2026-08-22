import { describe, expect, it } from "vitest";

import { isWaitlistEmail, normalizeWaitlistEmail } from "./waitlistEmail";

describe("normalizeWaitlistEmail", () => {
  it("trims and lowercases a synthetic address", () => {
    expect(normalizeWaitlistEmail("  SKATER+CAMPUS@Example.TEST ")).toBe(
      "skater+campus@example.test"
    );
  });
});

describe("isWaitlistEmail", () => {
  it("accepts ordinary and plus-tagged addresses", () => {
    expect(isWaitlistEmail("skater@example.test")).toBe(true);
    expect(isWaitlistEmail("skater+campus@example.test")).toBe(true);
    expect(isWaitlistEmail("a.b@school.edu")).toBe(true);
  });

  it("rejects missing pieces, whitespace, and header-injection characters", () => {
    expect(isWaitlistEmail("")).toBe(false);
    expect(isWaitlistEmail("skater")).toBe(false);
    expect(isWaitlistEmail("skater@example")).toBe(false);
    expect(isWaitlistEmail("skater@example.test\nbcc:other@example.test")).toBe(
      false
    );
    expect(isWaitlistEmail("skater@example.test ")).toBe(false);
    expect(isWaitlistEmail("@example.test")).toBe(false);
    expect(isWaitlistEmail("a".repeat(255) + "@example.test")).toBe(false);
  });
});
