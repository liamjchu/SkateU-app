import { HOME_SPOTS_PAGE_SIZE } from './homeFeed';

export const FEED_RECENCY_HALF_LIFE_HOURS = 36;
export const FEED_RECENCY_WEIGHT = 8;

export type FeedRankableSpot = {
  id: string;
  created_at: string;
  likes_count?: number;
  comments_count?: number;
};

export function feedSpotAgeHours(createdAt: string, nowMs: number): number {
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) {
    return 0;
  }

  return Math.max(0, (nowMs - createdMs) / (1000 * 60 * 60));
}

export function scoreFeedSpot(spot: FeedRankableSpot, nowMs: number): number {
  const recency = Math.pow(
    0.5,
    feedSpotAgeHours(spot.created_at, nowMs) / FEED_RECENCY_HALF_LIFE_HOURS
  );
  const engagement = Math.log1p(
    Math.max(0, spot.likes_count ?? 0) + Math.max(0, spot.comments_count ?? 0)
  );

  return recency * FEED_RECENCY_WEIGHT + engagement;
}

export function rankFeedSpots<T extends FeedRankableSpot>(
  spots: T[],
  nowMs = Date.now()
): T[] {
  return [...spots].sort((left, right) => {
    const scoreDelta = scoreFeedSpot(right, nowMs) - scoreFeedSpot(left, nowMs);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const createdDelta =
      Date.parse(right.created_at) - Date.parse(left.created_at);
    if (createdDelta !== 0) {
      return Number.isFinite(createdDelta) ? createdDelta : 0;
    }

    return right.id.localeCompare(left.id);
  });
}

export function sliceRankedFeedPage<T>(
  spots: T[],
  offset: number,
  pageSize = HOME_SPOTS_PAGE_SIZE
): T[] {
  const start = Math.max(0, offset);
  return spots.slice(start, start + pageSize);
}
