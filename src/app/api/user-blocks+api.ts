import { validateBlockUserBody } from '../../lib/userBlocks';
import type { BlockedUser } from '../../types/userBlock';
import {
  authUserMessage,
  getSupabaseConfig,
  resolveUserId,
  validateSpotId,
} from './spots+api';

type SupabaseConfig = { url: string; apiKey: string };

type DatabaseBlock = {
  blocked_id: string;
  created_at: string;
};

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

function supabaseHeaders(config: SupabaseConfig): HeadersInit {
  return {
    apikey: config.apiKey,
    Authorization: `Bearer ${config.apiKey}`,
  };
}

function isUniqueViolation(status: number, body: string): boolean {
  return status === 409 && (body.includes('23505') || /duplicate key/i.test(body));
}

async function fetchUsernames(
  config: SupabaseConfig,
  userIds: string[]
): Promise<Map<string, string | null>> {
  const usernames = new Map<string, string | null>();
  if (userIds.length === 0) {
    return usernames;
  }

  const query = new URL(`${config.url}/rest/v1/profiles`);
  query.searchParams.set('id', `in.(${userIds.join(',')})`);
  query.searchParams.set('select', 'id,username');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as {
    id?: string;
    username?: string | null;
  }[];
  for (const row of rows) {
    if (typeof row.id === 'string') {
      usernames.set(
        row.id,
        typeof row.username === 'string' ? row.username : null
      );
    }
  }
  return usernames;
}

async function listBlocks(
  config: SupabaseConfig,
  blockerId: string
): Promise<BlockedUser[]> {
  const query = new URL(`${config.url}/rest/v1/user_blocks`);
  query.searchParams.set('blocker_id', `eq.${blockerId}`);
  query.searchParams.set('select', 'blocked_id,created_at');
  query.searchParams.set('order', 'created_at.desc');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as DatabaseBlock[];
  const usernames = await fetchUsernames(
    config,
    rows.map((row) => row.blocked_id)
  );

  return rows.map((row) => ({
    userId: row.blocked_id,
    username: usernames.get(row.blocked_id) ?? null,
  }));
}

export async function GET(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json({ error: 'User blocks are not configured.' }, { status: 500 });
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  try {
    return Response.json({ users: await listBlocks(config, user.userId) });
  } catch (error) {
    console.error('Loading blocked users failed:', error);
    return Response.json(
      { error: 'Couldn’t load blocked accounts right now.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json({ error: 'User blocks are not configured.' }, { status: 500 });
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'The request body is malformed.' }, { status: 400 });
  }

  const validation = validateBlockUserBody(body, validateSpotId);
  if (!validation.ok) {
    return Response.json({ error: validation.message }, { status: 400 });
  }

  const blockedId = validation.value.userId;
  if (blockedId === user.userId) {
    return Response.json({ error: 'You can’t block yourself.' }, { status: 400 });
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/user_blocks`, {
      method: 'POST',
      headers: {
        ...supabaseHeaders(config),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        blocker_id: user.userId,
        blocked_id: blockedId,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      if (isUniqueViolation(response.status, message)) {
        const users = await listBlocks(config, user.userId);
        const existing = users.find((blocked) => blocked.userId === blockedId);
        return Response.json({
          user: existing ?? { userId: blockedId, username: null },
        });
      }
      throw new Error(message);
    }

    const usernames = await fetchUsernames(config, [blockedId]);
    return Response.json(
      {
        user: {
          userId: blockedId,
          username: usernames.get(blockedId) ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Blocking user failed:', error);
    return Response.json(
      { error: 'Couldn’t block that skater right now.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json({ error: 'User blocks are not configured.' }, { status: 500 });
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  const userValidation = validateSpotId(
    new URL(request.url).searchParams.get('userId')
  );
  if (!userValidation.ok) {
    return Response.json({ error: 'The user id is invalid.' }, { status: 400 });
  }

  try {
    const query = new URL(`${config.url}/rest/v1/user_blocks`);
    query.searchParams.set('blocker_id', `eq.${user.userId}`);
    query.searchParams.set('blocked_id', `eq.${userValidation.value}`);

    const response = await fetch(query.toString(), {
      method: 'DELETE',
      headers: supabaseHeaders(config),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Unblocking user failed:', error);
    return Response.json(
      { error: 'Couldn’t unblock that skater right now.' },
      { status: 500 }
    );
  }
}
