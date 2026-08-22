export const WAITLIST_RATE_LIMIT_RPC = "consume_waitlist_rate_limit";
export const defaultRateLimitMaxRequests = 5;
export const defaultRateLimitWindowMs = 60_000;
export const waitlistAbuseLimiterKey = "abuse:waitlist";

export type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export function environmentPositiveInteger(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);

  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function retryAfterSeconds(resetAt: number, now: number): number {
  return Math.max(1, Math.ceil((resetAt - now) / 1_000));
}

function trustedClientIp(request: Request): string | null {
  if (process.env.VERCEL === "1") {
    const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
    const ip = vercelForwarded?.split(",")[0]?.trim();
    return ip ? ip : null;
  }

  return null;
}

export function waitlistRateLimitKeys(request: Request, email: string): string[] {
  const trustedIp = trustedClientIp(request);

  if (trustedIp) {
    return [`ip:${trustedIp}`];
  }

  return [`email:${email}`, waitlistAbuseLimiterKey];
}

export function consumeRateLimitBuckets(
  store: Map<string, RateLimitBucket>,
  keys: string[],
  maxRequests: number,
  windowMs: number,
  now: number
): number | null {
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }

  let blockedRetryAfter: number | null = null;
  const uniqueKeys = [...new Set(keys)].sort();

  for (const key of uniqueKeys) {
    const bucket = store.get(key);

    if (!bucket || bucket.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      continue;
    }

    if (bucket.count >= maxRequests) {
      const retryAfter = retryAfterSeconds(bucket.resetAt, now);
      if (blockedRetryAfter === null || retryAfter > blockedRetryAfter) {
        blockedRetryAfter = retryAfter;
      }
      continue;
    }

    store.set(key, { count: bucket.count + 1, resetAt: bucket.resetAt });
  }

  return blockedRetryAfter;
}
