import { displayableAvatarUrl } from '../../lib/avatarUrl';
import {
  formatNotificationBody,
  parseNotificationType,
} from '../../lib/notifications';
import { rankFromXp } from '../../lib/xpRank';
import type { UserNotification } from '../../types/notification';
import {
  authUserMessage,
  getSupabaseConfig,
  resolveUserId,
  validateSpotId,
} from './spots+api';

type SupabaseConfig = { url: string; apiKey: string };

const NOTIFICATION_LIMIT = 50;
const NOTIFICATION_ROW_COLUMNS =
  'id,type,actor_id,spot_id,comment_id,read_at,created_at';
const SUPABASE_TIMEOUT_MS = 8_000;

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

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

async function supabaseFetch(
  input: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (isAbortError(error)) {
      const timedOut = new Error('Notifications lookup timed out.');
      timedOut.name = 'AbortError';
      throw timedOut;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

function parseExactCount(response: Response): number {
  const range =
    response.headers.get('content-range') ??
    response.headers.get('Content-Range');
  if (!range) {
    return 0;
  }

  const match = /\/(\d+|\*)$/.exec(range.trim());
  if (!match || match[1] === '*') {
    return 0;
  }

  const count = Number(match[1]);
  return Number.isFinite(count) ? count : 0;
}

function isMissingNotificationsTable(status: number, body: string): boolean {
  if (status !== 404 && status !== 400) {
    return false;
  }
  return (
    body.includes('PGRST205') ||
    body.includes("'public.user_notifications'")
  );
}

const EMPTY_INBOX = { notifications: [] as UserNotification[], unreadCount: 0 };

function firstEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function firstImageUrl(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const url = value.find(
    (item): item is string => typeof item === 'string' && item.length > 0
  );
  return url ?? null;
}

type DatabaseActor = {
  username?: string | null;
  avatar_url?: string | null;
  xp_total?: number | null;
};

type DatabaseSpot = {
  name?: string | null;
  image_urls?: unknown;
};

export type DatabaseNotification = {
  id: string;
  type: string;
  actor_id: string | null;
  spot_id: string | null;
  comment_id?: string | null;
  read_at: string | null;
  created_at: string;
  actor: DatabaseActor | DatabaseActor[] | null;
  spot: DatabaseSpot | DatabaseSpot[] | null;
};

export function mapNotification(row: DatabaseNotification): UserNotification | null {
  const type = parseNotificationType(row.type);
  if (!type || typeof row.id !== 'string' || row.id.length === 0) {
    return null;
  }

  const actor = firstEmbed(row.actor);
  const spot = firstEmbed(row.spot);
  const actorUsername =
    typeof actor?.username === 'string' && actor.username.length > 0
      ? actor.username
      : null;
  const spotName =
    typeof spot?.name === 'string' && spot.name.length > 0 ? spot.name : null;
  const actorXp =
    typeof actor?.xp_total === 'number' && Number.isFinite(actor.xp_total)
      ? actor.xp_total
      : null;

  return {
    id: row.id,
    type,
    body: formatNotificationBody({
      type,
      actorUsername,
      spotName,
    }),
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    readAt: typeof row.read_at === 'string' ? row.read_at : null,
    actorId: typeof row.actor_id === 'string' ? row.actor_id : null,
    actorUsername,
    actorAvatarUrl: displayableAvatarUrl(actor?.avatar_url),
    ...(actorXp !== null ? { actorRank: rankFromXp(actorXp) } : {}),
    spotId: typeof row.spot_id === 'string' ? row.spot_id : null,
    spotName,
    spotImageUrl: firstImageUrl(spot?.image_urls),
  };
}

function isUnreadCountOnly(request: Request): boolean {
  const value = new URL(request.url).searchParams.get('unreadCount');
  return value === '1' || value === 'true';
}

async function fetchUnreadCount(
  config: SupabaseConfig,
  userId: string
): Promise<number> {
  const query = new URL(`${config.url}/rest/v1/user_notifications`);
  query.searchParams.set('recipient_id', `eq.${userId}`);
  query.searchParams.set('hidden_at', 'is.null');
  query.searchParams.set('read_at', 'is.null');
  query.searchParams.set('select', 'id');

  const response = await supabaseFetch(query.toString(), {
    headers: {
      ...supabaseHeaders(config),
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  if (response.status === 416) {
    return parseExactCount(response);
  }
  if (response.ok || response.status === 206) {
    return parseExactCount(response);
  }
  const body = await response.text();
  if (isMissingNotificationsTable(response.status, body)) {
    return 0;
  }
  throw new Error(body);
}

type NotificationRow = {
  id: string;
  type: string;
  actor_id: string | null;
  spot_id: string | null;
  comment_id?: string | null;
  read_at: string | null;
  created_at: string;
};

async function fetchNotificationRows(
  config: SupabaseConfig,
  userId: string
): Promise<NotificationRow[]> {
  const query = new URL(`${config.url}/rest/v1/user_notifications`);
  query.searchParams.set('recipient_id', `eq.${userId}`);
  query.searchParams.set('hidden_at', 'is.null');
  query.searchParams.set('select', NOTIFICATION_ROW_COLUMNS);
  query.searchParams.set('order', 'created_at.desc,id.desc');
  query.searchParams.set('limit', String(NOTIFICATION_LIMIT));

  const response = await supabaseFetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    const body = await response.text();
    if (isMissingNotificationsTable(response.status, body)) {
      return [];
    }
    throw new Error(body);
  }

  const rows = (await response.json()) as NotificationRow[];
  return Array.isArray(rows) ? rows : [];
}

function uniqueIds(values: Array<string | null | undefined>): string[] {
  const ids = new Set<string>();
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) {
      ids.add(value);
    }
  }
  return [...ids];
}

async function fetchActorsById(
  config: SupabaseConfig,
  ids: string[]
): Promise<Map<string, DatabaseActor>> {
  const actors = new Map<string, DatabaseActor>();
  if (ids.length === 0) {
    return actors;
  }

  const query = new URL(`${config.url}/rest/v1/profiles`);
  query.searchParams.set('id', `in.(${ids.join(',')})`);
  query.searchParams.set('select', 'id,username,avatar_url,xp_total');
  const response = await supabaseFetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const rows = (await response.json()) as Array<DatabaseActor & { id?: string }>;
  for (const row of rows) {
    if (typeof row.id === 'string') {
      actors.set(row.id, row);
    }
  }
  return actors;
}

async function fetchBlockedActorIds(
  config: SupabaseConfig,
  userId: string
): Promise<string[]> {
  const query = new URL(`${config.url}/rest/v1/user_blocks`);
  query.searchParams.set(
    'or',
    `(blocker_id.eq.${userId},blocked_id.eq.${userId})`
  );
  query.searchParams.set('select', 'blocker_id,blocked_id');
  const response = await supabaseFetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as {
    blocker_id?: string;
    blocked_id?: string;
  }[];
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.blocker_id === userId && typeof row.blocked_id === 'string') {
      if (row.blocked_id.length > 0) {
        ids.add(row.blocked_id);
      }
    } else if (
      row.blocked_id === userId &&
      typeof row.blocker_id === 'string' &&
      row.blocker_id.length > 0
    ) {
      ids.add(row.blocker_id);
    }
  }
  return [...ids];
}

async function fetchSpotsById(
  config: SupabaseConfig,
  ids: string[]
): Promise<Map<string, DatabaseSpot>> {
  const spots = new Map<string, DatabaseSpot>();
  if (ids.length === 0) {
    return spots;
  }

  const query = new URL(`${config.url}/rest/v1/spots`);
  query.searchParams.set('id', `in.(${ids.join(',')})`);
  query.searchParams.set('select', 'id,name,image_urls');
  const response = await supabaseFetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const rows = (await response.json()) as Array<DatabaseSpot & { id?: string }>;
  for (const row of rows) {
    if (typeof row.id === 'string') {
      spots.set(row.id, row);
    }
  }
  return spots;
}

export async function GET(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Notifications are not configured.' },
      { status: 500 }
    );
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  try {
    if (isUnreadCountOnly(request)) {
      const unreadCount = await fetchUnreadCount(config, user.userId);
      return Response.json({ unreadCount, notifications: [] });
    }

    const rows = await fetchNotificationRows(config, user.userId);
    if (rows.length === 0) {
      return Response.json(EMPTY_INBOX);
    }

    const actorIds = uniqueIds(rows.map((row) => row.actor_id));
    const spotIds = uniqueIds(rows.map((row) => row.spot_id));
    const [blockedIds, actors, spots] = await Promise.all([
      fetchBlockedActorIds(config, user.userId),
      fetchActorsById(config, actorIds),
      fetchSpotsById(config, spotIds),
    ]);
    const blocked = new Set(blockedIds);

    const notifications = rows
      .filter(
        (row) =>
          typeof row.actor_id !== 'string' ||
          row.actor_id.length === 0 ||
          !blocked.has(row.actor_id)
      )
      .map((row) =>
        mapNotification({
          ...row,
          actor: row.actor_id ? (actors.get(row.actor_id) ?? null) : null,
          spot: row.spot_id ? (spots.get(row.spot_id) ?? null) : null,
        })
      )
      .filter((item): item is UserNotification => item !== null);

    return Response.json({
      notifications,
      unreadCount: notifications.filter((item) => item.readAt === null).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      isAbortError(error) ||
      isMissingNotificationsTable(404, message) ||
      isMissingNotificationsTable(400, message)
    ) {
      return Response.json(EMPTY_INBOX);
    }
    console.error('Loading notifications failed:', error);
    return Response.json(
      { error: 'Couldn’t load notifications right now.' },
      { status: 500 }
    );
  }
}

type PatchBody = {
  id?: unknown;
};

export async function PATCH(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Notifications are not configured.' },
      { status: 500 }
    );
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  let body: PatchBody = {};
  try {
    const parsed: unknown = await request.json();
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as PatchBody;
    }
  } catch {
    return Response.json({ error: 'The request body is malformed.' }, { status: 400 });
  }

  let notificationId: string | null = null;
  if (body.id !== undefined && body.id !== null) {
    if (typeof body.id !== 'string') {
      return Response.json({ error: 'The notification id is invalid.' }, { status: 400 });
    }
    const validation = validateSpotId(body.id);
    if (!validation.ok) {
      return Response.json({ error: 'The notification id is invalid.' }, { status: 400 });
    }
    notificationId = validation.value;
  }

  const query = new URL(`${config.url}/rest/v1/user_notifications`);
  query.searchParams.set('recipient_id', `eq.${user.userId}`);
  query.searchParams.set('hidden_at', 'is.null');
  query.searchParams.set('read_at', 'is.null');
  if (notificationId) {
    query.searchParams.set('id', `eq.${notificationId}`);
  }

  try {
    const response = await supabaseFetch(query.toString(), {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(config),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ read_at: new Date().toISOString() }),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      if (isMissingNotificationsTable(response.status, errorBody)) {
        return Response.json({ ok: true });
      }
      throw new Error(errorBody);
    }
    return Response.json({ ok: true });
  } catch (error) {
    if (isAbortError(error) || isMissingNotificationsTable(404, String(error))) {
      return Response.json({ ok: true });
    }
    console.error('Marking notifications read failed:', error);
    return Response.json(
      { error: 'Couldn’t update notifications right now.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Notifications are not configured.' },
      { status: 500 }
    );
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  const idParam = new URL(request.url).searchParams.get('id');
  const validation = validateSpotId(idParam);
  if (!validation.ok) {
    return Response.json({ error: 'The notification id is invalid.' }, { status: 400 });
  }

  const query = new URL(`${config.url}/rest/v1/user_notifications`);
  query.searchParams.set('id', `eq.${validation.value}`);
  query.searchParams.set('recipient_id', `eq.${user.userId}`);
  query.searchParams.set('hidden_at', 'is.null');

  try {
    const response = await supabaseFetch(query.toString(), {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(config),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ hidden_at: new Date().toISOString() }),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Hiding notification failed:', error);
    return Response.json(
      { error: 'Couldn’t hide that notification right now.' },
      { status: 500 }
    );
  }
}
