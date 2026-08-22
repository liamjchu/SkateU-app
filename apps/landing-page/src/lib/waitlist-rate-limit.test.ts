import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  consumeRateLimitBuckets,
  retryAfterSeconds,
  waitlistAbuseLimiterKey,
  waitlistRateLimitKeys,
  type RateLimitBucket,
} from "./waitlist-rate-limit";

const email = "skater@example.test";
const now = 1_700_000_000_000;
const windowMs = 60_000;

function requestWith(headers: HeadersInit): Request {
  return new Request("https://landing.example.test/api/subscribe", {
    method: "POST",
    headers,
  });
}

describe("waitlistRateLimitKeys", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ignores forged x-forwarded-for and uses email plus the shared abuse key", () => {
    const first = waitlistRateLimitKeys(
      requestWith({ "x-forwarded-for": "198.51.100.1" }),
      email
    );
    const second = waitlistRateLimitKeys(
      requestWith({
        "x-forwarded-for": "203.0.113.9",
        "x-real-ip": "192.0.2.1",
      }),
      email
    );

    expect(first).toEqual([`email:${email}`, waitlistAbuseLimiterKey]);
    expect(second).toEqual(first);
  });

  it("uses only the Vercel-authenticated client IP when that header is present", () => {
    vi.stubEnv("VERCEL", "1");

    const keys = waitlistRateLimitKeys(
      requestWith({
        "x-forwarded-for": "198.51.100.1",
        "x-vercel-forwarded-for": "203.0.113.10",
      }),
      email
    );

    expect(keys).toEqual(["ip:203.0.113.10"]);
  });
});

describe("consumeRateLimitBuckets", () => {
  it("reads and updates buckets atomically without incrementing a blocked key", () => {
    const store = new Map<string, RateLimitBucket>();
    const keys = [`email:${email}`, waitlistAbuseLimiterKey];
    const results = Array.from({ length: 5 }, () =>
      consumeRateLimitBuckets(store, keys, 3, windowMs, now)
    );

    expect(results.filter((result) => result === null)).toHaveLength(3);
    expect(results.filter((result) => result !== null)).toEqual([60, 60]);
    expect(store.get(`email:${email}`)).toEqual({
      count: 3,
      resetAt: now + windowMs,
    });
    expect(store.get(waitlistAbuseLimiterKey)).toEqual({
      count: 3,
      resetAt: now + windowMs,
    });
  });

  it("returns a positive Retry-After that matches the remaining window", () => {
    const store = new Map<string, RateLimitBucket>([
      [email, { count: 5, resetAt: now + 1_500 }],
    ]);

    expect(consumeRateLimitBuckets(store, [email], 5, windowMs, now)).toBe(2);
    expect(retryAfterSeconds(now + 60_000, now)).toBe(60);
    expect(retryAfterSeconds(now + 1, now)).toBe(1);
  });

  it("deletes expired buckets before consuming a new window", () => {
    const store = new Map<string, RateLimitBucket>([
      ["stale", { count: 5, resetAt: now }],
      [email, { count: 5, resetAt: now }],
    ]);

    expect(consumeRateLimitBuckets(store, [email], 1, windowMs, now)).toBeNull();
    expect(store.has("stale")).toBe(false);
    expect(store.get(email)).toEqual({ count: 1, resetAt: now + windowMs });
  });
});
