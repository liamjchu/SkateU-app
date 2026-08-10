
export const RESEND_COOLDOWN_SECONDS = 60;

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
};

export type ResendGateway = {
  claimCooldown: (email: string, emailHash: string) => Promise<number>;
  resend: (email: string) => Promise<void>;
};

type ResendRequest = { email: string };
type GatewayFactory = () => ResendGateway;

function response(status: number, body?: Record<string, unknown>): Response {
  return new Response(body ? JSON.stringify(body) : null, { status, headers: corsHeaders });
}

function accepted(retryAfterSeconds: number): Response {
  return response(202, { retryAfterSeconds });
}

function requiredEnvironmentValue(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return (
    email.length > 0 &&
    email.length <= 254 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
  );
}

export async function hashEmail(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(email);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createGateway(): ResendGateway {
  const supabaseUrl = requiredEnvironmentValue("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requiredEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY");
  const headers = {
    apikey: serviceRoleKey,
    "Content-Type": "application/json",
  };

  return {
    async claimCooldown(email: string, emailHash: string): Promise<number> {
      const rpcResponse = await fetch(
        `${supabaseUrl}/rest/v1/rpc/claim_signup_confirmation_resend`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            p_email: email,
            p_email_hash: emailHash,
            p_cooldown_seconds: RESEND_COOLDOWN_SECONDS,
          }),
        }
      );

      if (!rpcResponse.ok) {
        throw new Error(`Cooldown RPC failed with status ${rpcResponse.status}`);
      }

      const data: unknown = await rpcResponse.json();
      if (typeof data !== "number" || data < 0) {
        throw new Error("Cooldown RPC returned an invalid response");
      }

      return data;
    },
    async resend(email: string): Promise<void> {
      const resendResponse = await fetch(`${supabaseUrl}/auth/v1/resend`, {
        method: "POST",
        headers,
        body: JSON.stringify({ type: "signup", email }),
      });

      if (!resendResponse.ok) {
        throw new Error(`Supabase Auth resend failed with status ${resendResponse.status}`);
      }
    },
  };
}

async function parseRequest(request: Request): Promise<ResendRequest | null> {
  try {
    const value: unknown = await request.json();
    if (
      typeof value !== "object" ||
      value === null ||
      !("email" in value) ||
      typeof value.email !== "string"
    ) {
      return null;
    }
    return { email: value.email };
  } catch {
    return null;
  }
}

export async function handleResendSignupConfirmation(
  request: Request,
  gatewayFactory: GatewayFactory = createGateway
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return response(204);
  }
  if (request.method !== "POST") {
    return response(405);
  }

  const payload = await parseRequest(request);
  const email = payload ? normalizeEmail(payload.email) : "";
  if (!isValidEmail(email)) {
    return response(400, { error: "Enter a valid email address." });
  }

  try {
    const gateway = gatewayFactory();
    const retryAfterSeconds = await gateway.claimCooldown(email, await hashEmail(email));

    // A cooldown is a successful generic response: callers learn neither
    // account state nor whether an email was dispatched for this address.
    if (retryAfterSeconds > 0) {
      return accepted(retryAfterSeconds);
    }

    try {
      await gateway.resend(email);
    } catch (error) {
      // Supabase Auth deliberately keeps resend outcomes generic. Preserve that
      // behavior here and omit addresses from logs to avoid leaking PII.
      console.error("Signup confirmation resend failed.", error);
    }

    return accepted(RESEND_COOLDOWN_SECONDS);
  } catch (error) {
    console.error("Signup confirmation resend request failed.", error);
    return response(503, { error: "Could not request another code. Try again shortly." });
  }
}

if (import.meta.main) {
  Deno.serve((request) => handleResendSignupConfirmation(request));
}
