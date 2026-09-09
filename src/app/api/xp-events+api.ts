import {
  formatXpEventLine,
  parseXpEventReason,
} from '../../lib/xpRank';
import type { XpEventView } from '../../types/xp';
import {
  authUserMessage,
  getSupabaseConfig,
  resolveUserId,
} from './spots+api';

type SupabaseConfig = { url: string; apiKey: string };

const XP_EVENT_LIMIT = 50;

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

type DatabaseXpEvent = {
  id: string;
  delta: number;
  reason: string;
  spot_id: string | null;
  created_at: string;
  spot: { name: string | null } | { name: string | null }[] | null;
};

export function mapXpEvent(row: DatabaseXpEvent): XpEventView | null {
  const reason = parseXpEventReason(row.reason);
  if (!reason) {
    return null;
  }
  if (typeof row.delta !== 'number' || !Number.isFinite(row.delta) || row.delta === 0) {
    return null;
  }
  const spot = Array.isArray(row.spot) ? row.spot[0] : row.spot;
  const spotName =
    typeof spot?.name === 'string' && spot.name.length > 0 ? spot.name : null;
  const spotId = typeof row.spot_id === 'string' && row.spot_id.length > 0 ? row.spot_id : null;

  return {
    id: row.id,
    delta: row.delta,
    reason,
    spotId,
    spotName,
    createdAt: row.created_at ?? '',
    summary: formatXpEventLine({
      delta: row.delta,
      reason,
      spotName,
    }),
  };
}

export async function GET(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json({ error: 'XP is not configured.' }, { status: 500 });
  }

  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return Response.json({ error: authUserMessage('missing') }, { status: 401 });
  }

  const auth = await resolveUserId(config, accessToken);
  if (!auth.ok) {
    return authError(auth.reason);
  }

  const query = new URL(`${config.url}/rest/v1/xp_events`);
  query.searchParams.set('user_id', `eq.${auth.userId}`);
  query.searchParams.set(
    'select',
    'id,delta,reason,spot_id,created_at,spot:spots(name)'
  );
  query.searchParams.set('order', 'created_at.desc');
  query.searchParams.set('limit', String(XP_EVENT_LIMIT));

  try {
    const response = await fetch(query.toString(), {
      headers: supabaseHeaders(config),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }

    const rows = (await response.json()) as DatabaseXpEvent[];
    const events = rows
      .map(mapXpEvent)
      .filter((event): event is XpEventView => event !== null);

    return Response.json({ events });
  } catch (error) {
    console.error('Loading XP events failed:', error);
    return Response.json(
      { error: 'Couldn’t load XP history right now.' },
      { status: 500 }
    );
  }
}
