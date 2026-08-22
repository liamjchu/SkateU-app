import { NextResponse } from "next/server";

import { WAITLIST_MAX_BODY_BYTES } from "../../../constants/site";
import { getSupabaseAdmin } from "../../../lib/supabase-server";
import {
  WAITLIST_RATE_LIMIT_RPC,
  defaultRateLimitMaxRequests,
  defaultRateLimitWindowMs,
  environmentPositiveInteger,
  waitlistRateLimitKeys,
} from "../../../lib/waitlist-rate-limit";
import {
  isWaitlistEmail,
  normalizeWaitlistEmail,
} from "../../../lib/waitlistEmail";

const dispatchTimeoutMs = 15_000;

const failureResponse = () =>
  NextResponse.json({ error: "Unable to join the waitlist." }, { status: 500 });
const invalidRequestResponse = () =>
  NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

function rateLimitResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: "Too many waitlist requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": retryAfterSeconds.toString() },
    }
  );
}

function requestBodyTooLarge(request: Request): boolean {
  const contentLength = Number.parseInt(
    request.headers.get("content-length") ?? "",
    10
  );

  return Number.isSafeInteger(contentLength) && contentLength > WAITLIST_MAX_BODY_BYTES;
}

async function waitlistRateLimitRetryAfterSeconds(
  request: Request,
  email: string
): Promise<number | null> {
  const { data, error } = await getSupabaseAdmin().rpc(WAITLIST_RATE_LIMIT_RPC, {
    p_keys: waitlistRateLimitKeys(request, email),
    p_max_requests: environmentPositiveInteger(
      "WAITLIST_RATE_LIMIT_MAX_REQUESTS",
      defaultRateLimitMaxRequests
    ),
    p_window_ms: environmentPositiveInteger(
      "WAITLIST_RATE_LIMIT_WINDOW_MS",
      defaultRateLimitWindowMs
    ),
  });

  if (error || typeof data !== "number" || !Number.isFinite(data) || data < 0) {
    throw new Error("Waitlist rate limit unavailable.");
  }

  return data > 0 ? data : null;
}

async function dispatchConfirmationEmail(email: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const dispatchSecret = process.env.SUBSCRIPTION_DISPATCH_SECRET;

  if (!supabaseUrl || !anonKey || !dispatchSecret) {
    return false;
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

    return dispatchResponse.ok;
  } catch {
    return false;
  }
}

async function handleSubscription(request: Request): Promise<NextResponse> {
  if (requestBodyTooLarge(request)) {
    return invalidRequestResponse();
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return invalidRequestResponse();
  }

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

  if (!("confirmedAge13Plus" in payload) || payload.confirmedAge13Plus !== true) {
    return NextResponse.json(
      { error: "You must be at least 13 years old to join the waitlist." },
      { status: 400 }
    );
  }

  const email = normalizeWaitlistEmail(payload.email);

  if (!isWaitlistEmail(email)) {
    return invalidRequestResponse();
  }

  const retryAfterSeconds = await waitlistRateLimitRetryAfterSeconds(
    request,
    email
  );

  if (retryAfterSeconds !== null) {
    return rateLimitResponse(retryAfterSeconds);
  }

  const { error: subscribeError } = await getSupabaseAdmin().rpc(
    "subscribe_email",
    { p_email: email }
  );

  if (subscribeError) {
    return failureResponse();
  }

  const emailSent = await dispatchConfirmationEmail(email);

  return NextResponse.json({ success: true, emailSent });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Method not allowed." },
    { status: 405, headers: { Allow: "POST" } }
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    return await handleSubscription(request);
  } catch {
    return failureResponse();
  }
}
