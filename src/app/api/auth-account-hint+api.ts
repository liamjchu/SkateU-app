import { getSupabaseConfig } from './spots+api';
import {
  hintFromProviders,
  parseAuthAccountHint,
  type AuthAccountHint,
} from '../../lib/authAccount';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AdminUser = {
  email?: string | null;
  identities?: { provider?: string }[] | null;
  app_metadata?: { providers?: unknown };
};

function readEmail(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const email = (body as { email?: unknown }).email;
  if (typeof email !== 'string') {
    return null;
  }
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 320 || !EMAIL_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function providersFromAdminUser(user: AdminUser): string[] {
  const fromMetadata = user.app_metadata?.providers;
  if (Array.isArray(fromMetadata)) {
    return fromMetadata.filter((value): value is string => typeof value === 'string');
  }
  return (user.identities ?? [])
    .map((identity) => identity.provider)
    .filter((value): value is string => typeof value === 'string');
}

export function hintFromAdminUser(user: AdminUser | null): AuthAccountHint {
  if (!user) {
    return 'unknown';
  }
  return hintFromProviders(providersFromAdminUser(user));
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ hint: 'unknown' });
  }

  const email = readEmail(body);
  if (!email) {
    return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const config = getSupabaseConfig();
  if (!config) {
    return Response.json({ hint: 'unknown' });
  }

  try {
    const query = new URL(`${config.url}/auth/v1/admin/users`);
    query.searchParams.set('email', email);
    query.searchParams.set('per_page', '5');

    const response = await fetch(query.toString(), {
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      return Response.json({ hint: 'unknown' });
    }

    const payload = (await response.json()) as { users?: AdminUser[] } | AdminUser[];
    const users = Array.isArray(payload) ? payload : payload.users ?? [];
    const match = users.find(
      (user) => (user.email ?? '').trim().toLowerCase() === email
    );

    return Response.json({ hint: hintFromAdminUser(match ?? null) });
  } catch (error) {
    console.error('Auth account hint lookup failed:', error);
    return Response.json({ hint: 'unknown' });
  }
}

export function parseHintResponse(payload: unknown): AuthAccountHint {
  if (!payload || typeof payload !== 'object') {
    return 'unknown';
  }
  return parseAuthAccountHint((payload as { hint?: unknown }).hint);
}
