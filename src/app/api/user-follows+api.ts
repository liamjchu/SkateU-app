import {
  validateFollowListParam,
  validateFollowUserBody,
} from '../../lib/userFollows';
import {
  fetchFollowListUsers,
  fetchFollowStats,
  hasBlockEitherWay,
} from './followGraph';
import {
  authUserMessage,
  getSupabaseConfig,
  resolveUserId,
  validateSpotId,
} from './spots+api';

type SupabaseConfig = { url: string; apiKey: string };

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

async function resolveOptionalViewer(
  request: Request,
  config: SupabaseConfig
): Promise<string | null> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return null;
  }

  const auth = await resolveUserId(config, accessToken);
  return auth.ok ? auth.userId : null;
}

export async function GET(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json({ error: 'Follows are not configured.' }, { status: 500 });
  }

  const params = new URL(request.url).searchParams;
  const userValidation = validateSpotId(params.get('userId'));
  if (!userValidation.ok) {
    return Response.json({ error: 'The user id is invalid.' }, { status: 400 });
  }

  const listValidation = validateFollowListParam(params.get('list'));
  if (!listValidation.ok) {
    return Response.json({ error: listValidation.message }, { status: 400 });
  }

  const userId = userValidation.value;

  try {
    const viewerId = await resolveOptionalViewer(request, config);
    if (viewerId && viewerId !== userId) {
      const blocked = await hasBlockEitherWay(config, viewerId, userId);
      if (blocked) {
        return Response.json(
          { error: 'This profile isn’t available.' },
          { status: 403 }
        );
      }
    }

    const users = await fetchFollowListUsers(
      config,
      userId,
      listValidation.value,
      viewerId
    );
    return Response.json({ users });
  } catch (error) {
    console.error('Loading follow list failed:', error);
    return Response.json(
      { error: 'Couldn’t load that list right now.' },
      { status: 500 }
    );
  }
}

async function followStatsResponse(
  config: SupabaseConfig,
  profileUserId: string,
  viewerId: string,
  status = 200
): Promise<Response> {
  const stats = await fetchFollowStats(config, profileUserId, viewerId);
  return Response.json(stats, { status });
}

export async function POST(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json({ error: 'Follows are not configured.' }, { status: 500 });
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'The request body is malformed.' }, { status: 400 });
  }

  const validation = validateFollowUserBody(body, validateSpotId);
  if (!validation.ok) {
    return Response.json({ error: validation.message }, { status: 400 });
  }

  const followingId = validation.value.userId;
  if (followingId === user.userId) {
    return Response.json({ error: 'You can’t follow yourself.' }, { status: 400 });
  }

  try {
    const blocked = await hasBlockEitherWay(config, user.userId, followingId);
    if (blocked) {
      return Response.json(
        { error: 'You can’t follow that skater.' },
        { status: 403 }
      );
    }

    const response = await fetch(`${config.url}/rest/v1/user_follows`, {
      method: 'POST',
      headers: {
        ...supabaseHeaders(config),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        follower_id: user.userId,
        following_id: followingId,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      if (isUniqueViolation(response.status, message)) {
        return followStatsResponse(config, followingId, user.userId);
      }
      throw new Error(message);
    }

    return followStatsResponse(config, followingId, user.userId, 201);
  } catch (error) {
    console.error('Following user failed:', error);
    return Response.json(
      { error: 'Couldn’t follow that skater right now.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json({ error: 'Follows are not configured.' }, { status: 500 });
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  const userValidation = validateSpotId(
    new URL(request.url).searchParams.get('userId')
  );
  if (!userValidation.ok) {
    return Response.json({ error: 'The user id is invalid.' }, { status: 400 });
  }

  const followingId = userValidation.value;

  try {
    const query = new URL(`${config.url}/rest/v1/user_follows`);
    query.searchParams.set('follower_id', `eq.${user.userId}`);
    query.searchParams.set('following_id', `eq.${followingId}`);

    const response = await fetch(query.toString(), {
      method: 'DELETE',
      headers: supabaseHeaders(config),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }

    return followStatsResponse(config, followingId, user.userId);
  } catch (error) {
    console.error('Unfollowing user failed:', error);
    return Response.json(
      { error: 'Couldn’t unfollow that skater right now.' },
      { status: 500 }
    );
  }
}
