import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "../../../lib/supabase-server";

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const dispatchTimeoutMs = 15_000;
const defaultRateLimitMaxRequests = 5;
const defaultRateLimitWindowMs = 60_000;
const rateLimitByIp = new Map<string, { count: number; resetAt: number }>();

const failureResponse = () =>
  NextResponse.json({ error: "Unable to join the waitlist." }, { status: 500 });
const invalidRequestResponse = () =>
  NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

function environmentPositiveInteger(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);

  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function clientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  return (
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimitRetryAfterSeconds(ip: string): number | null {
  const maxRequests = environmentPositiveInteger(
    "WAITLIST_RATE_LIMIT_MAX_REQUESTS",
    defaultRateLimitMaxRequests
  );
  const windowMs = environmentPositiveInteger(
    "WAITLIST_RATE_LIMIT_WINDOW_MS",
    defaultRateLimitWindowMs
  );
  const now = Date.now();

  for (const [key, limit] of rateLimitByIp) {
    if (limit.resetAt <= now) {
      rateLimitByIp.delete(key);
    }
  }

  const limit = rateLimitByIp.get(ip);

  if (!limit || limit.resetAt <= now) {
    rateLimitByIp.set(ip, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (limit.count >= maxRequests) {
    return Math.max(1, Math.ceil((limit.resetAt - now) / 1_000));
  }

  limit.count += 1;
  return null;
}

function rateLimitResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: "Too many waitlist requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": retryAfterSeconds.toString() },
    }
  );
}

async function handleSubscription(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return invalidRequestResponse();
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("email" in payload) ||
    typeof payload.email !== "string"
  ) {
    return invalidRequestResponse();
  }

  const email = payload.email.trim().toLowerCase();

  if (
    email.length === 0 ||
    email.length > 254 ||
    !emailPattern.test(email)
  ) {
    return invalidRequestResponse();
  }

  const { error: subscribeError } = await getSupabaseAdmin().rpc(
    "subscribe_email",
    { p_email: email }
  );

  if (subscribeError) {
    return failureResponse();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const dispatchSecret = process.env.SUBSCRIPTION_DISPATCH_SECRET;

  if (!supabaseUrl || !anonKey || !dispatchSecret) {
    return failureResponse();
  }

  try {
    const dispatchResponse = await fetch(
      new URL("/functions/v1/send-confirmation", supabaseUrl),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          "x-subscription-dispatch-secret": dispatchSecret,
        },
        body: JSON.stringify({ email }),
        cache: "no-store",
        signal: AbortSignal.timeout(dispatchTimeoutMs),
      }
    );

    if (!dispatchResponse.ok) {
      return failureResponse();
    }
  } catch {
    return failureResponse();
  }

  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  const retryAfterSeconds = rateLimitRetryAfterSeconds(clientIp(request));

  if (retryAfterSeconds !== null) {
    return rateLimitResponse(retryAfterSeconds);
  }

  try {
    return await handleSubscription(request);
  } catch {
    return failureResponse();
  }
}
