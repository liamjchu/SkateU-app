import {
  SPOT_REMOVAL_REQUESTS_PER_DAY,
  isSpotRemovalReason,
  validateSpotRemovalRequestBody,
} from '../../lib/spotRemovalRequest';
import { sendSpotReviewEmail } from '../../lib/spotRemovalNotify';
import type { SpotRemovalReason, SpotRemovalRequest } from '../../types/spotRemovalRequest';
import {
  authUserMessage,
  fetchSpotOwnership,
  getSupabaseConfig,
  isHiddenSpotStatus,
  parseSpotStatus,
  resolveUserId,
  validateSpotId,
  type SpotModerationStatus,
} from './spots+api';

type SupabaseConfig = { url: string; apiKey: string };

type DatabaseRemovalRequest = {
  id: string;
  spot_id: string;
  reason: string;
  details: string;
  created_at: string;
};

type SpotReviewRow = {
  id: string;
  name: string;
  status?: string;
  reviewed_at?: string | null;
  review_notified_at?: string | null;
  schools: { name: string } | null;
};

const REQUEST_SELECT_COLUMNS = 'id,spot_id,reason,details,created_at';
const REVIEW_SPOT_SELECT_COLUMNS =
  'id,name,status,reviewed_at,review_notified_at,schools(name)';
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const SPOT_GONE_ERROR = 'That spot no longer exists.';
const OWN_SPOT_ERROR = 'You can delete your own spots instead.';
const RATE_LIMIT_ERROR = 'You can only submit a few removal requests each day.';

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

export function mapRemovalRequest(row: DatabaseRemovalRequest): SpotRemovalRequest {
  const reason: SpotRemovalReason = isSpotRemovalReason(row.reason)
    ? row.reason
    : 'other';

  return {
    id: row.id,
    spotId: row.spot_id,
    reason,
    details: row.details ?? '',
    createdAt: row.created_at ?? '',
  };
}

function isUniqueViolation(status: number, body: string): boolean {
  if (status !== 409) {
    return false;
  }

  return body.includes('23505') || /duplicate key/i.test(body);
}

async function fetchOwnRequest(
  config: SupabaseConfig,
  spotId: string,
  userId: string
): Promise<SpotRemovalRequest | null> {
  const query = new URL(`${config.url}/rest/v1/spot_removal_requests`);
  query.searchParams.set('spot_id', `eq.${spotId}`);
  query.searchParams.set('user_id', `eq.${userId}`);
  query.searchParams.set('select', REQUEST_SELECT_COLUMNS);
  query.searchParams.set('limit', '1');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as DatabaseRemovalRequest[];
  return rows[0] ? mapRemovalRequest(rows[0]) : null;
}

async function countRecentRequests(
  config: SupabaseConfig,
  userId: string
): Promise<number> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const query = new URL(`${config.url}/rest/v1/spot_removal_requests`);
  query.searchParams.set('user_id', `eq.${userId}`);
  query.searchParams.set('created_at', `gte.${since}`);
  query.searchParams.set('select', 'id');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as { id: string }[];
  return rows.length;
}

async function fetchReviewSpot(
  config: SupabaseConfig,
  spotId: string
): Promise<SpotReviewRow | null> {
  const query = new URL(`${config.url}/rest/v1/spots`);
  query.searchParams.set('id', `eq.${spotId}`);
  query.searchParams.set('select', REVIEW_SPOT_SELECT_COLUMNS);

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as SpotReviewRow[];
  return rows[0] ?? null;
}

async function fetchRequestsSinceReview(
  config: SupabaseConfig,
  spotId: string,
  reviewedAt: string | null | undefined
): Promise<DatabaseRemovalRequest[]> {
  const query = new URL(`${config.url}/rest/v1/spot_removal_requests`);
  query.searchParams.set('spot_id', `eq.${spotId}`);
  query.searchParams.set('select', REQUEST_SELECT_COLUMNS);
  query.searchParams.set('order', 'created_at.asc');
  if (reviewedAt) {
    query.searchParams.set('created_at', `gt.${reviewedAt}`);
  }

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as DatabaseRemovalRequest[];
}

async function claimReviewNotification(
  config: SupabaseConfig,
  spotId: string
): Promise<boolean> {
  const query = new URL(`${config.url}/rest/v1/spots`);
  query.searchParams.set('id', `eq.${spotId}`);
  query.searchParams.set('status', 'eq.under_review');
  query.searchParams.set('review_notified_at', 'is.null');
  query.searchParams.set('select', 'id');

  const response = await fetch(query.toString(), {
    method: 'PATCH',
    headers: {
      ...supabaseHeaders(config),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ review_notified_at: new Date().toISOString() }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as { id: string }[];
  return rows.length > 0;
}

async function maybeNotifyReviewNeeded(
  config: SupabaseConfig,
  spotId: string
): Promise<void> {
  const spot = await fetchReviewSpot(config, spotId);
  const status: SpotModerationStatus = parseSpotStatus(spot?.status);
  if (!spot || status !== 'under_review' || spot.review_notified_at) {
    return;
  }

  const claimed = await claimReviewNotification(config, spotId);
  if (!claimed) {
    return;
  }

  const requests = await fetchRequestsSinceReview(
    config,
    spotId,
    spot.reviewed_at
  );
  const mapped = requests.map(mapRemovalRequest);

  try {
    await sendSpotReviewEmail({
      spotId: spot.id,
      spotName: spot.name,
      schoolName: spot.schools?.name ?? '',
      uniqueRequestCount: mapped.length,
      reasons: mapped.map((request) => request.reason),
      details: mapped.map((request) => request.details),
    });
  } catch (error) {
    console.error('Sending spot review email failed:', error);
  }
}

export async function GET(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Spot removal requests are not configured.' },
      { status: 500 }
    );
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  const spotValidation = validateSpotId(
    new URL(request.url).searchParams.get('spotId')
  );
  if (!spotValidation.ok) {
    return Response.json({ error: spotValidation.message }, { status: 400 });
  }

  try {
    const requestRow = await fetchOwnRequest(
      config,
      spotValidation.value,
      user.userId
    );
    return Response.json({ request: requestRow });
  } catch (error) {
    console.error('Loading spot removal request failed:', error);
    return Response.json(
      { error: 'Unable to load this removal request right now.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Spot removal requests are not configured.' },
      { status: 500 }
    );
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'The request body is malformed.' }, { status: 400 });
  }

  const validation = validateSpotRemovalRequestBody(body, validateSpotId);
  if (!validation.ok) {
    return Response.json({ error: validation.message }, { status: 400 });
  }

  const { spotId, reason, details } = validation.value;

  try {
    const ownership = await fetchSpotOwnership(config, spotId);
    if (!ownership.found || isHiddenSpotStatus(ownership.status)) {
      return Response.json({ error: SPOT_GONE_ERROR }, { status: 404 });
    }
    if (ownership.ownerId === user.userId) {
      return Response.json({ error: OWN_SPOT_ERROR }, { status: 400 });
    }

    const existing = await fetchOwnRequest(config, spotId, user.userId);
    if (existing) {
      return Response.json({ request: existing, alreadySubmitted: true });
    }

    const recentCount = await countRecentRequests(config, user.userId);
    if (recentCount >= SPOT_REMOVAL_REQUESTS_PER_DAY) {
      return Response.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const insertUrl = new URL(`${config.url}/rest/v1/spot_removal_requests`);
    insertUrl.searchParams.set('select', REQUEST_SELECT_COLUMNS);

    const insertResponse = await fetch(insertUrl.toString(), {
      method: 'POST',
      headers: {
        ...supabaseHeaders(config),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        spot_id: spotId,
        user_id: user.userId,
        reason,
        details,
      }),
    });

    if (!insertResponse.ok) {
      const errorBody = await insertResponse.text();
      if (isUniqueViolation(insertResponse.status, errorBody)) {
        const duplicate = await fetchOwnRequest(config, spotId, user.userId);
        if (duplicate) {
          return Response.json({ request: duplicate, alreadySubmitted: true });
        }
      }
      throw new Error(errorBody);
    }

    const rows = (await insertResponse.json()) as DatabaseRemovalRequest[];
    const created = rows[0];
    if (!created) {
      throw new Error('Insert returned no representation.');
    }

    try {
      await maybeNotifyReviewNeeded(config, spotId);
    } catch (error) {
      console.error('Spot review notification failed:', error);
    }

    return Response.json({ request: mapRemovalRequest(created) }, { status: 201 });
  } catch (error) {
    console.error('Creating spot removal request failed:', error);
    return Response.json(
      { error: 'Couldn’t submit this removal request right now.' },
      { status: 500 }
    );
  }
}
