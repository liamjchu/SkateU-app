export const RESEND_SIGNUP_COOLDOWN_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 10_000;

export type ResendSignupConfirmationResult = {
  retryAfterSeconds: number;
};

type ResendResponse = {
  retryAfterSeconds?: unknown;
};

function getFunctionUrl(): string {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error('Email confirmation is not configured. Please try again later.');
  }

  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/resend-signup-confirmation`;
}

function getAnonKey(): string {
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!anonKey) {
    throw new Error('Email confirmation is not configured. Please try again later.');
  }

  return anonKey;
}

function retryAfterSeconds(value: unknown): number {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= 86_400
    ? value
    : RESEND_SIGNUP_COOLDOWN_SECONDS;
}

async function readResponse(response: Response): Promise<ResendResponse | null> {
  try {
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null ? (body as ResendResponse) : null;
  } catch {
    return null;
  }
}

/**
 * Requests another signup code from the protected Edge Function. The function
 * intentionally returns the same accepted response for unknown, confirmed,
 * and pending addresses to avoid account enumeration.
 */
export async function resendSignupConfirmation(
  email: string,
  fetchImplementation: typeof fetch = fetch
): Promise<ResendSignupConfirmationResult> {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    throw new Error('Enter an email address before requesting a new code.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const anonKey = getAnonKey();
    const response = await fetchImplementation(getFunctionUrl(), {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: normalizedEmail }),
      signal: controller.signal,
    });
    const body = await readResponse(response);

    if (!response.ok) {
      throw new Error('Could not request another code. Try again shortly.');
    }

    return { retryAfterSeconds: retryAfterSeconds(body?.retryAfterSeconds) };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Requesting another code timed out. Try again shortly.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
