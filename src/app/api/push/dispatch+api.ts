import {
  mapProfileNotificationPreferences,
  preferenceAllowsPush,
} from '../../../lib/notificationPreferences';
import {
  buildExpoPushMessage,
  sendExpoPushMessages,
  tokensToDrop,
} from '../../../lib/expoPush';
import { parseNotificationType } from '../../../lib/notifications';
import { getSupabaseConfig, validateSpotId } from '../spots+api';
import { mapNotification, type DatabaseNotification } from '../notifications+api';

type SupabaseConfig = { url: string; apiKey: string };

function supabaseHeaders(config: SupabaseConfig): HeadersInit {
  return {
    apikey: config.apiKey,
    Authorization: `Bearer ${config.apiKey}`,
  };
}

function readDispatchSecret(request: Request): string | null {
  const header =
    request.headers.get('x-push-dispatch-secret') ??
    request.headers.get('X-Push-Dispatch-Secret');
  if (header && header.trim().length > 0) {
    return header.trim();
  }
  const auth =
    request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match ? match[1].trim() : null;
}

function secretsMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < provided.length; index += 1) {
    mismatch |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

function notificationIdFromBody(value: unknown): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id === 'string') {
    const validation = validateSpotId(record.id);
    return validation.ok ? validation.value : null;
  }
  const nested = record.record;
  if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) {
    const nestedId = (nested as { id?: unknown }).id;
    if (typeof nestedId === 'string') {
      const validation = validateSpotId(nestedId);
      return validation.ok ? validation.value : null;
    }
  }
  return null;
}

async function fetchJson<T>(
  url: string,
  config: SupabaseConfig
): Promise<T | null> {
  const response = await fetch(url, { headers: supabaseHeaders(config) });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
}

export async function POST(request: Request): Promise<Response> {
  const expected = process.env.PUSH_DISPATCH_SECRET?.trim();
  if (!expected) {
    return Response.json(
      { error: 'Push dispatch is not configured.' },
      { status: 500 }
    );
  }

  const provided = readDispatchSecret(request);
  if (!provided || !secretsMatch(provided, expected)) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Push dispatch is not configured.' },
      { status: 500 }
    );
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return Response.json({ error: 'The request body is malformed.' }, { status: 400 });
  }

  const notificationId = notificationIdFromBody(parsed);
  if (!notificationId) {
    return Response.json({ error: 'The notification id is invalid.' }, { status: 400 });
  }

  try {
    const rowQuery = new URL(`${config.url}/rest/v1/user_notifications`);
    rowQuery.searchParams.set('id', `eq.${notificationId}`);
    rowQuery.searchParams.set(
      'select',
      'id,type,actor_id,spot_id,comment_id,read_at,created_at,recipient_id,hidden_at'
    );
    rowQuery.searchParams.set('limit', '1');
    const rows = await fetchJson<
      Array<{
        id: string;
        type: string;
        actor_id: string | null;
        spot_id: string | null;
        comment_id?: string | null;
        read_at: string | null;
        created_at: string;
        recipient_id?: string;
        hidden_at?: string | null;
      }>
    >(rowQuery.toString(), config);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      return Response.json({ ok: true, skipped: 'missing' });
    }
    if (row.hidden_at) {
      return Response.json({ ok: true, skipped: 'hidden' });
    }

    const type = parseNotificationType(row.type);
    const recipientId =
      typeof row.recipient_id === 'string' ? row.recipient_id : null;
    if (!type || !recipientId) {
      return Response.json({ ok: true, skipped: 'invalid' });
    }

    const prefQuery = new URL(`${config.url}/rest/v1/profiles`);
    prefQuery.searchParams.set('id', `eq.${recipientId}`);
    prefQuery.searchParams.set(
      'select',
      'push_enabled,notify_social,notify_campus,notify_spot_updates'
    );
    prefQuery.searchParams.set('limit', '1');
    const prefRows = await fetchJson<
      Array<{
        push_enabled?: unknown;
        notify_social?: unknown;
        notify_campus?: unknown;
        notify_spot_updates?: unknown;
      }>
    >(prefQuery.toString(), config);
    const prefs = mapProfileNotificationPreferences(prefRows?.[0] ?? {});
    if (!preferenceAllowsPush(type, prefs)) {
      return Response.json({ ok: true, skipped: 'prefs' });
    }

    let actor: DatabaseNotification['actor'] = null;
    if (row.actor_id) {
      const actorQuery = new URL(`${config.url}/rest/v1/profiles`);
      actorQuery.searchParams.set('id', `eq.${row.actor_id}`);
      actorQuery.searchParams.set('select', 'username,avatar_url,xp_total');
      actorQuery.searchParams.set('limit', '1');
      const actors = await fetchJson<DatabaseNotification['actor'][]>(
        actorQuery.toString(),
        config
      );
      actor = Array.isArray(actors) ? (actors[0] ?? null) : null;
    }

    let spot: DatabaseNotification['spot'] = null;
    if (row.spot_id) {
      const spotQuery = new URL(`${config.url}/rest/v1/spots`);
      spotQuery.searchParams.set('id', `eq.${row.spot_id}`);
      spotQuery.searchParams.set('select', 'name,image_urls,school_id');
      spotQuery.searchParams.set('limit', '1');
      const spots = await fetchJson<
        Array<{
          name?: string | null;
          image_urls?: unknown;
          school_id?: string | null;
        }>
      >(spotQuery.toString(), config);
      const spotRow = Array.isArray(spots) ? spots[0] : null;
      if (spotRow) {
        let schoolName: string | null = null;
        if (typeof spotRow.school_id === 'string') {
          const schoolQuery = new URL(`${config.url}/rest/v1/schools`);
          schoolQuery.searchParams.set('id', `eq.${spotRow.school_id}`);
          schoolQuery.searchParams.set('select', 'name');
          schoolQuery.searchParams.set('limit', '1');
          const schools = await fetchJson<Array<{ name?: string }>>(
            schoolQuery.toString(),
            config
          );
          const school = Array.isArray(schools) ? schools[0] : null;
          schoolName =
            typeof school?.name === 'string' && school.name.length > 0
              ? school.name
              : null;
        }
        spot = {
          name: spotRow.name,
          image_urls: spotRow.image_urls,
          school_id: spotRow.school_id,
          school_name: schoolName,
        };
      }
    }

    const mapped = mapNotification({
      id: row.id,
      type: row.type,
      actor_id: row.actor_id,
      spot_id: row.spot_id,
      comment_id: row.comment_id,
      read_at: row.read_at,
      created_at: row.created_at,
      actor,
      spot,
    });
    if (!mapped) {
      return Response.json({ ok: true, skipped: 'invalid' });
    }

    const tokenQuery = new URL(`${config.url}/rest/v1/push_tokens`);
    tokenQuery.searchParams.set('user_id', `eq.${recipientId}`);
    tokenQuery.searchParams.set('select', 'expo_push_token');
    const tokenRows = await fetchJson<Array<{ expo_push_token?: string }>>(
      tokenQuery.toString(),
      config
    );
    const tokens = (Array.isArray(tokenRows) ? tokenRows : [])
      .map((item) => item.expo_push_token)
      .filter((token): token is string => typeof token === 'string' && token.length > 0);

    if (tokens.length === 0) {
      return Response.json({ ok: true, skipped: 'no_tokens' });
    }

    const data: Record<string, string> = {
      notificationId: mapped.id,
      type: mapped.type,
    };
    if (mapped.spotId) {
      data.spotId = mapped.spotId;
    }
    if (mapped.spotName) {
      data.spotName = mapped.spotName;
    }
    if (mapped.actorId) {
      data.userId = mapped.actorId;
    }

    const messages = tokens.map((token) =>
      buildExpoPushMessage({
        token,
        body: mapped.body,
        data,
      })
    );
    const tickets = await sendExpoPushMessages(messages);
    const stale = tokensToDrop(messages, tickets);
    if (stale.length > 0) {
      await Promise.all(
        stale.map((token) => {
          const deleteQuery = new URL(`${config.url}/rest/v1/push_tokens`);
          deleteQuery.searchParams.set('user_id', `eq.${recipientId}`);
          deleteQuery.searchParams.set('expo_push_token', `eq.${token}`);
          return fetch(deleteQuery.toString(), {
            method: 'DELETE',
            headers: {
              ...supabaseHeaders(config),
              Prefer: 'return=minimal',
            },
          });
        })
      );
    }

    return Response.json({ ok: true, sent: messages.length - stale.length });
  } catch (error) {
    console.error('Dispatching push notification failed:', error);
    return Response.json(
      { error: 'Couldn’t dispatch that notification right now.' },
      { status: 500 }
    );
  }
}
