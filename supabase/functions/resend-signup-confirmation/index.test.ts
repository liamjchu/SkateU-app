import {
    handleResendSignupConfirmation,
    hashEmail,
    isValidEmail,
    normalizeEmail,
    type ResendGateway,
} from "./index.ts";

function request(email: unknown): Request {
  return new Request("https://project.supabase.co/functions/v1/resend-signup-confirmation", {
    method: "POST",
    body: JSON.stringify({ email }),
    headers: { "Content-Type": "application/json" },
  });
}

function gateway(
  retryAfterSeconds: number,
  onResend: () => Promise<void> = async () => undefined
): ResendGateway {
  return {
    claimCooldown: async () => retryAfterSeconds,
    resend: onResend,
  };
}

Deno.test("normalizes and validates signup confirmation email addresses", async () => {
  const normalized = normalizeEmail("  Skater@Example.edu ");
  if (normalized !== "skater@example.edu" || !isValidEmail(normalized)) {
    throw new Error("Expected normalized valid email");
  }
  if (isValidEmail("not-an-email") || (await hashEmail(normalized)).length !== 64) {
    throw new Error("Expected invalid input rejection and SHA-256 digest");
  }
});

Deno.test("does not dispatch while an atomic cooldown remains", async () => {
  let resendCalls = 0;
  const response = await handleResendSignupConfirmation(
    request("skater@example.edu"),
    () => gateway(34, async () => { resendCalls += 1; })
  );
  const body = (await response.json()) as { retryAfterSeconds?: unknown };

  if (response.status !== 202 || body.retryAfterSeconds !== 34 || resendCalls !== 0) {
    throw new Error("Expected generic cooldown response without an email dispatch");
  }
});

Deno.test("returns the same accepted result when Supabase refuses a resend", async () => {
  const response = await handleResendSignupConfirmation(
    request("skater@example.edu"),
    () => gateway(0, async () => { throw new Error("user already confirmed"); })
  );
  const body = (await response.json()) as { retryAfterSeconds?: unknown };

  if (response.status !== 202 || body.retryAfterSeconds !== 60) {
    throw new Error("Expected generic accepted response");
  }
});

Deno.test("rejects malformed requests before accessing the gateway", async () => {
  let called = false;
  const response = await handleResendSignupConfirmation(
    request("not-an-email"),
    () => {
      called = true;
      return gateway(0);
    }
  );

  if (response.status !== 400 || called) {
    throw new Error("Expected malformed input to be rejected locally");
  }
});

Deno.test("returns a generic service error when the cooldown store is unavailable", async () => {
  const response = await handleResendSignupConfirmation(
    request("skater@example.edu"),
    () => ({
      claimCooldown: async () => { throw new Error("database unavailable"); },
      resend: async () => undefined,
    })
  );

  if (response.status !== 503) {
    throw new Error("Expected a generic service error");
  }
});
