import { validatePassword } from '../../lib/password';
import {
  AUTH_REQUEST_TIMEOUT_MS,
  authUserMessage,
  getSupabaseConfig,
  resolveUserId,
} from './spots+api';

const MAX_PASSWORD_LENGTH = 128;

type AdminUser = {
  app_metadata?: { providers?: unknown };
  identities?: { provider?: string }[] | null;
};

function readBearerToken(request: Request): string | null {
  const header =
    request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function providersWithEmail(user: AdminUser): string[] {
  const fromMetadata = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers.filter(
        (value): value is string => typeof value === 'string'
      )
    : [];
  const fromIdentities = (user.identities ?? [])
    .map((identity) => identity.provider)
    .filter((value): value is string => typeof value === 'string');

  return [...new Set([...fromMetadata, ...fromIdentities, 'email'])];
}

function adminErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      code?: unknown;
      msg?: unknown;
      message?: unknown;
      error?: unknown;
    };
    const code = typeof parsed.code === 'string' ? parsed.code : '';
    const message =
      (typeof parsed.msg === 'string' && parsed.msg) ||
      (typeof parsed.message === 'string' && parsed.message) ||
      (typeof parsed.error === 'string' && parsed.error) ||
      '';

    if (code === 'weak_password' || /weak|leaked|pwned|easy to guess/i.test(message)) {
      return 'That password is too easy to guess. Choose a different one.';
    }
    if (code === 'same_password' || /different from the old password/i.test(message)) {
      return 'Choose a password you have not used before.';
    }
  } catch {
    // Fall through to the generic copy.
  }

  return 'We couldn’t update your password right now. Please try again.';
}

async function readPassword(request: Request): Promise<string | null> {
  try {
    const payload = (await request.json()) as { password?: unknown };
    return typeof payload.password === 'string' ? payload.password : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return Response.json(
      { error: authUserMessage('missing') },
      { status: 401 }
    );
  }

  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Setting a password is not configured.' },
      { status: 500 }
    );
  }

  const password = await readPassword(request);
  if (password == null || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    return Response.json(
      { error: 'Enter a valid password.' },
      { status: 400 }
    );
  }

  const policyError = validatePassword(password);
  if (policyError) {
    return Response.json({ error: policyError }, { status: 400 });
  }

  const auth = await resolveUserId(config, accessToken);
  if (!auth.ok) {
    return Response.json(
      { error: authUserMessage(auth.reason) },
      { status: auth.reason === 'timeout' ? 503 : 401 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

  try {
    const adminHeaders = {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
    const adminUserUrl = `${config.url}/auth/v1/admin/users/${auth.userId}`;

    const existingResponse = await fetch(adminUserUrl, {
      headers: adminHeaders,
      signal: controller.signal,
    });
    const existingUser = existingResponse.ok
      ? ((await existingResponse.json()) as AdminUser)
      : null;

    const updateBody: { password: string; app_metadata?: { providers: string[] } } =
      existingUser
        ? { password, app_metadata: { providers: providersWithEmail(existingUser) } }
        : { password };

    const updateResponse = await fetch(adminUserUrl, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify(updateBody),
      signal: controller.signal,
    });

    if (!updateResponse.ok) {
      const body = await updateResponse.text();
      console.error('Admin set password failed:', updateResponse.status, body);
      return Response.json(
        { error: adminErrorMessage(body) },
        { status: updateResponse.status === 422 ? 400 : 502 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    console.error('Set password failed:', error);
    return Response.json(
      {
        error: timedOut
          ? 'Setting a password timed out. Please try again.'
          : 'We couldn’t update your password right now. Please try again.',
      },
      { status: timedOut ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
