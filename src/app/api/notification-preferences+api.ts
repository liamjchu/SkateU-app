import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  mapProfileNotificationPreferences,
  parseNotificationPreferences,
  type NotificationPreferences,
} from '../../lib/notificationPreferences';
import {
  authUserMessage,
  getSupabaseConfig,
  resolveUserId,
} from './spots+api';

type SupabaseConfig = { url: string; apiKey: string };

const PREF_COLUMNS =
  'push_enabled,notify_social,notify_campus,notify_spot_updates';

function readBearerToken(request: Request): string | null {
  const header =
    request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function authError(reason: 'invalid' | 'expired' | 'timeout'): Response {
  const status = reason === 'timeout' ? 503 : 401;
  return Response.json({ error: authUserMessage(reason) }, { status });
}

function supabaseHeaders(config: SupabaseConfig): HeadersInit {
  return {
    apikey: config.apiKey,
    Authorization: `Bearer ${config.apiKey}`,
  };
}

async function requireUser(
  request: Request,
  config: SupabaseConfig
): Promise<{ userId: string } | Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return Response.json({ error: authUserMessage('missing') }, { status: 401 });
  }

  const auth = await resolveUserId(config, accessToken);
  return auth.ok ? { userId: auth.userId } : authError(auth.reason);
}

function isMissingPrefColumns(status: number, body: string): boolean {
  if (status !== 400 && status !== 404) {
    return false;
  }
  return (
    body.includes('push_enabled') ||
    body.includes('PGRST204') ||
    body.includes('schema cache')
  );
}

async function fetchPreferences(
  config: SupabaseConfig,
  userId: string
): Promise<NotificationPreferences> {
  const query = new URL(`${config.url}/rest/v1/profiles`);
  query.searchParams.set('id', `eq.${userId}`);
  query.searchParams.set('select', PREF_COLUMNS);
  query.searchParams.set('limit', '1');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    const body = await response.text();
    if (isMissingPrefColumns(response.status, body)) {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }
    throw new Error(body);
  }
  const rows = (await response.json()) as unknown[];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || typeof row !== 'object') {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
  return mapProfileNotificationPreferences(
    row as {
      push_enabled?: unknown;
      notify_social?: unknown;
      notify_campus?: unknown;
      notify_spot_updates?: unknown;
    }
  );
}

export async function GET(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Notification preferences are not configured.' },
      { status: 500 }
    );
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  try {
    const preferences = await fetchPreferences(config, user.userId);
    return Response.json({ preferences });
  } catch (error) {
    console.error('Loading notification preferences failed:', error);
    return Response.json(
      { error: 'Couldn’t load notification preferences right now.' },
      { status: 500 }
    );
  }
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export async function PATCH(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Notification preferences are not configured.' },
      { status: 500 }
    );
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return Response.json({ error: 'The request body is malformed.' }, { status: 400 });
  }

  const record =
    parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  try {
    const current = await fetchPreferences(config, user.userId);
    const next = parseNotificationPreferences({
      pushEnabled: readOptionalBoolean(record.pushEnabled) ?? current.pushEnabled,
      notifySocial:
        readOptionalBoolean(record.notifySocial) ?? current.notifySocial,
      notifyCampus:
        readOptionalBoolean(record.notifyCampus) ?? current.notifyCampus,
      notifySpotUpdates:
        readOptionalBoolean(record.notifySpotUpdates) ??
        current.notifySpotUpdates,
    });

    const query = new URL(`${config.url}/rest/v1/profiles`);
    query.searchParams.set('id', `eq.${user.userId}`);

    const response = await fetch(query.toString(), {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(config),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        push_enabled: next.pushEnabled,
        notify_social: next.notifySocial,
        notify_campus: next.notifyCampus,
        notify_spot_updates: next.notifySpotUpdates,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      if (isMissingPrefColumns(response.status, body)) {
        return Response.json({ preferences: next });
      }
      throw new Error(body);
    }
    const rows = (await response.json()) as unknown[];
    const row = Array.isArray(rows) ? rows[0] : null;
    const preferences =
      row && typeof row === 'object'
        ? mapProfileNotificationPreferences(
            row as {
              push_enabled?: unknown;
              notify_social?: unknown;
              notify_campus?: unknown;
              notify_spot_updates?: unknown;
            }
          )
        : next;
    return Response.json({ preferences });
  } catch (error) {
    console.error('Saving notification preferences failed:', error);
    return Response.json(
      { error: 'Couldn’t save notification preferences right now.' },
      { status: 500 }
    );
  }
}
