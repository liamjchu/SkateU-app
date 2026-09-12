import { getApiUrl } from './api';
import { parseXpEventReason } from './xpRank';
import type { XpEventView } from '../types/xp';

const LOAD_FAILED_ERROR = 'Couldn’t load XP history right now.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mapXpEventView(value: unknown): XpEventView | null {
  if (!isRecord(value)) {
    return null;
  }
  const reason = parseXpEventReason(value.reason);
  if (!reason) {
    return null;
  }
  const id = typeof value.id === 'string' && value.id.length > 0 ? value.id : null;
  const delta =
    typeof value.delta === 'number' && Number.isFinite(value.delta) ? value.delta : null;
  if (!id || delta === null || delta === 0) {
    return null;
  }

  return {
    id,
    delta,
    reason,
    spotId: typeof value.spotId === 'string' ? value.spotId : null,
    spotName: typeof value.spotName === 'string' ? value.spotName : null,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    summary: typeof value.summary === 'string' ? value.summary : '',
  };
}

export async function fetchXpEvents(accessToken: string): Promise<XpEventView[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(getApiUrl('/api/xp-events'), {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(LOAD_FAILED_ERROR);
    }
    const payload = (await response.json()) as unknown;
    if (!isRecord(payload) || !Array.isArray(payload.events)) {
      throw new Error(LOAD_FAILED_ERROR);
    }
    return payload.events
      .map(mapXpEventView)
      .filter((event): event is XpEventView => event !== null);
  } finally {
    clearTimeout(timeout);
  }
}
