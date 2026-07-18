import {
    getSupabaseConfig,
    mapSpot,
    resolveUserId,
    SPOT_SELECT_COLUMNS,
    validateSpotId,
    type DatabaseSpot,
} from './spots+api';

type SupabaseConfig = { url: string; apiKey: string };

type LikeRow = { spot_id: string; created_at: string };

type LikeCountRow = { likes_count: number };

const POSTGREST_IN_FILTER_BATCH_SIZE = 100;

function chunkIds(ids: string[]): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += POSTGREST_IN_FILTER_BATCH_SIZE) {
    chunks.push(ids.slice(index, index + POSTGREST_IN_FILTER_BATCH_SIZE));
  }
  return chunks;
}

function readBearerToken(request: Request): string | null {
  const header =
    request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function authError(reason: 'invalid' | 'expired' | 'timeout'): Response {
  if (reason === 'timeout') {
    return Response.json(
      { error: 'Account verification timed out. Please try again.' },
      { status: 503 }
    );
  }

  return Response.json(
    {
      error:
        reason === 'expired'
          ? 'The access token is expired.'
          : 'The access token is invalid.',
    },
    { status: 401 }
  );
}

async function requireUser(
  request: Request,
  config: SupabaseConfig
): Promise<{ userId: string } | Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return Response.json(
      { error: 'Authentication is required for spot likes.' },
      { status: 401 }
    );
  }

  const auth = await resolveUserId(config, accessToken);
  return auth.ok ? { userId: auth.userId } : authError(auth.reason);
}

async function readSpotLikeCount(
  config: SupabaseConfig,
  spotId: string
): Promise<number | null> {
  const query = new URL(`${config.url}/rest/v1/spots`);
  query.searchParams.set('id', `eq.${spotId}`);
  query.searchParams.set('select', 'likes_count');

  const response = await fetch(query.toString(), {
    headers: { apikey: config.apiKey, Authorization: `Bearer ${config.apiKey}` },
  });
  if (!response.ok) throw new Error(await response.text());

  const rows = (await response.json()) as LikeCountRow[];
  return rows[0] ? rows[0].likes_count : null;
}

async function fetchLikedSpotIds(
  config: SupabaseConfig,
  userId: string,
  spotIds?: string[]
): Promise<string[]> {
  const batches =
    spotIds && spotIds.length > 0 ? chunkIds(spotIds) : [undefined];
  const rowsByBatch = await Promise.all(
    batches.map(async (batch) => {
      const query = new URL(`${config.url}/rest/v1/spot_likes`);
      query.searchParams.set('user_id', `eq.${userId}`);
      query.searchParams.set('select', 'spot_id,created_at');
      query.searchParams.set('order', 'created_at.desc');
      if (batch) {
        query.searchParams.set('spot_id', `in.(${batch.join(',')})`);
      }

      const response = await fetch(query.toString(), {
        headers: { apikey: config.apiKey, Authorization: `Bearer ${config.apiKey}` },
      });
      if (!response.ok) throw new Error(await response.text());

      return (await response.json()) as LikeRow[];
    })
  );

  return rowsByBatch
    .flat()
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((row) => row.spot_id);
}

async function getLikedSpots(
  config: SupabaseConfig,
  userId: string
): Promise<Response> {
  const likedIds = await fetchLikedSpotIds(config, userId);
  if (likedIds.length === 0) return Response.json({ spots: [] });

  const rowsByBatch = await Promise.all(
    chunkIds(likedIds).map(async (batch) => {
      const query = new URL(`${config.url}/rest/v1/spots`);
      query.searchParams.set('id', `in.(${batch.join(',')})`);
      query.searchParams.set('select', SPOT_SELECT_COLUMNS);

      const response = await fetch(query.toString(), {
        headers: { apikey: config.apiKey, Authorization: `Bearer ${config.apiKey}` },
      });
      if (!response.ok) throw new Error(await response.text());

      return (await response.json()) as DatabaseSpot[];
    })
  );
  const rows = rowsByBatch.flat();
  const byId = new Map(rows.map((row) => [row.id, row]));
  return Response.json({
    spots: likedIds
      .map((id) => byId.get(id))
      .filter((row): row is DatabaseSpot => row !== undefined)
      .map((row) => mapSpot(row, true)),
  });
}
export async function GET(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json({ error: 'Spot likes database is not configured.' }, { status: 500 });
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  try {
    return await getLikedSpots(config, user.userId);
  } catch (error) {
    console.error('Loading liked spots failed:', error);
    return Response.json({ error: 'Unable to load liked spots right now.' }, { status: 500 });
  }
}

async function changeLike(request: Request, shouldLike: boolean): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json({ error: 'Spot likes database is not configured.' }, { status: 500 });
  }

  const idValidation = validateSpotId(new URL(request.url).searchParams.get('id'));
  if (!idValidation.ok) return Response.json({ error: idValidation.message }, { status: 400 });

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  try {
    const spotId = idValidation.value;
    const existingCount = await readSpotLikeCount(config, spotId);
    if (existingCount === null) {
      return Response.json({ error: 'That spot no longer exists.' }, { status: 404 });
    }

    const query = new URL(`${config.url}/rest/v1/spot_likes`);
    query.searchParams.set('spot_id', `eq.${spotId}`);
    query.searchParams.set('user_id', `eq.${user.userId}`);

    const response = shouldLike
      ? await fetch(`${config.url}/rest/v1/spot_likes`, {
          method: 'POST',
          headers: {
            apikey: config.apiKey,
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=ignore-duplicates,return=minimal',
          },
          body: JSON.stringify({ spot_id: spotId, user_id: user.userId }),
        })
      : await fetch(query.toString(), {
          method: 'DELETE',
          headers: { apikey: config.apiKey, Authorization: `Bearer ${config.apiKey}` },
        });

    if (!response.ok) throw new Error(await response.text());

    const likeCount = await readSpotLikeCount(config, spotId);
    return Response.json({ likeCount: likeCount ?? 0, likedByUser: shouldLike });
  } catch (error) {
    console.error(`${shouldLike ? 'Adding' : 'Removing'} spot like failed:`, error);
    return Response.json(
      { error: `Unable to ${shouldLike ? 'like' : 'unlike'} this spot right now.` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  return changeLike(request, true);
}

export async function DELETE(request: Request): Promise<Response> {
  return changeLike(request, false);
}
