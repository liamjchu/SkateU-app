import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { timingSafeEqual } from "jsr:@std/crypto/timing-safe-equal";

type SubscriberConfirmation = {
  email: string;
  confirmation_token: string | null;
  confirmation_expires_at: string | null;
  confirmation_sent_at: string | null;
  confirmed: boolean;
  subscribed: boolean;
};

type DispatchRequest = {
  email: string;
};

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const textEncoder = new TextEncoder();

function requiredEnvironmentValue(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function response(status: number): Response {
  return new Response(null, { status });
}

function isDispatchRequest(value: unknown): value is DispatchRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "email" in value &&
    typeof value.email === "string"
  );
}

function hasValidDispatchSecret(
  providedSecret: string | null,
  dispatchSecret: string
): boolean {
  if (!providedSecret) {
    return false;
  }

  const providedBytes = textEncoder.encode(providedSecret);
  const expectedBytes = textEncoder.encode(dispatchSecret);

  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };

    return entities[character];
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return response(405);
  }

  const dispatchSecret = requiredEnvironmentValue(
    "SUBSCRIPTION_DISPATCH_SECRET"
  );

  if (
    !hasValidDispatchSecret(
      request.headers.get("x-subscription-dispatch-secret"),
      dispatchSecret
    )
  ) {
    return response(401);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return response(400);
  }

  if (!isDispatchRequest(payload)) {
    return response(400);
  }

  const email = payload.email.trim().toLowerCase();

  if (
    email.length === 0 ||
    email.length > 254 ||
    !emailPattern.test(email)
  ) {
    return response(400);
  }

  const supabase = createClient(
    requiredEnvironmentValue("SUPABASE_URL"),
    requiredEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data, error } = await supabase
    .from("subscribers")
    .select(
      "email, confirmation_token, confirmation_expires_at, confirmation_sent_at, confirmed, subscribed"
    )
    .eq("email", email)
    .maybeSingle();
  const subscriber = data as SubscriberConfirmation | null;

  if (error) {
    return response(500);
  }

  if (!subscriber) {
    return response(204);
  }

  const expiresAt = subscriber.confirmation_expires_at
    ? Date.parse(subscriber.confirmation_expires_at)
    : Number.NaN;

  if (
    !subscriber.subscribed ||
    subscriber.confirmed ||
    !subscriber.confirmation_token ||
    Number.isNaN(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    return response(204);
  }

  let confirmationUrl: URL;

  try {
    confirmationUrl = new URL(
      "/confirm",
      requiredEnvironmentValue("APP_URL")
    );
  } catch {
    return response(500);
  }

  confirmationUrl.searchParams.set("token", subscriber.confirmation_token);

  let resendResponse: Response;

  try {
    resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredEnvironmentValue("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `subscription-confirmation:${subscriber.confirmation_token}:${subscriber.confirmation_sent_at ?? "initial"}`,
      },
      body: JSON.stringify({
        from: requiredEnvironmentValue("RESEND_FROM_EMAIL"),
        to: [subscriber.email],
        subject: "Confirm your SkateU email",
        html: `<p>Confirm your SkateU email address by clicking the link below.</p><p><a href="${escapeHtml(confirmationUrl.toString())}">Confirm my email</a></p>`,
        text: `Confirm your SkateU email address: ${confirmationUrl.toString()}`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return response(502);
  }

  if (!resendResponse.ok) {
    return response(502);
  }

  const { error: updateError } = await supabase
    .from("subscribers")
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq("email", subscriber.email)
    .eq("confirmation_token", subscriber.confirmation_token)
    .eq("confirmed", false)
    .eq("subscribed", true);

  return updateError ? response(500) : response(204);
});
