export const FEED_SEEN_CAP = 2000;

export function rememberSeenSpotIds(
  seenIds: readonly string[],
  spotId: string
): string[] {
  if (spotId.length === 0) {
    return [...seenIds];
  }

  const next = [...seenIds.filter((id) => id !== spotId), spotId];
  if (next.length <= FEED_SEEN_CAP) {
    return next;
  }

  return next.slice(next.length - FEED_SEEN_CAP);
}

export function parseSeenSpotIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
    if (unique.length >= FEED_SEEN_CAP) {
      break;
    }
  }
  return unique;
}

export const FEED_RECYCLE_REMAINING_ITEMS = 3;

export function shuffleFeedSpots<T>(spots: T[], seed: number): T[] {
  const next = [...spots];
  let state = (seed || 1) >>> 0;
  for (let index = next.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swapAt = state % (index + 1);
    const current = next[index];
    next[index] = next[swapAt];
    next[swapAt] = current;
  }
  return next;
}

function recycleCycle<T extends { id: string }>(
  pool: T[],
  lastId: string | undefined,
  seed: number
): T[] {
  const shuffled = shuffleFeedSpots(pool, seed);
  if (shuffled.length < 2 || !lastId || shuffled[0].id !== lastId) {
    return shuffled;
  }

  const swapAt = shuffled.findIndex(
    (spot, index) => index > 0 && spot.id !== lastId
  );
  if (swapAt < 0) {
    return shuffled;
  }

  const swapped = [...shuffled];
  const first = swapped[0];
  swapped[0] = swapped[swapAt];
  swapped[swapAt] = first;
  return swapped;
}

export function excludeSeenSpots<T extends { id: string }>(
  spots: T[],
  seenIds: readonly string[]
): T[] {
  if (seenIds.length === 0) {
    return spots;
  }

  const seen = new Set(seenIds);
  return spots.filter((spot) => !seen.has(spot.id));
}

export function lastViewedSpotId<T extends { id: string }>(
  spots: T[],
  seenIds: readonly string[]
): string | null {
  const ids = new Set(spots.map((spot) => spot.id));
  for (let index = seenIds.length - 1; index >= 0; index -= 1) {
    const spotId = seenIds[index];
    if (ids.has(spotId)) {
      return spotId;
    }
  }
  return null;
}

export function rotateSpotsAfter<T extends { id: string }>(
  spots: T[],
  lastId?: string
): T[] {
  if (spots.length === 0) {
    return spots;
  }

  const start = lastId ? spots.findIndex((spot) => spot.id === lastId) : -1;
  if (start < 0) {
    return spots;
  }

  return [...spots.slice(start + 1), ...spots.slice(0, start + 1)];
}

export function startFeedSession<T extends { id: string }>(
  spots: T[],
  seenIds: readonly string[]
): T[] {
  if (spots.length === 0) {
    return spots;
  }

  const lastId = lastViewedSpotId(spots, seenIds);
  const unseen = excludeSeenSpots(spots, seenIds);

  if (!lastId) {
    return unseen.length > 0 ? unseen : spots;
  }

  const lastSpot = spots.find((spot) => spot.id === lastId);
  if (!lastSpot) {
    return unseen.length > 0 ? unseen : spots;
  }

  const restUnseen = unseen.filter((spot) => spot.id !== lastId);
  if (restUnseen.length > 0) {
    return [lastSpot, ...restUnseen];
  }

  const start = spots.findIndex((spot) => spot.id === lastId);
  return [...spots.slice(start), ...spots.slice(0, start)];
}

export function recycleFeedSpots<T extends { id: string }>(
  session: T[],
  pool: T[],
  visibleIndex = 0
): T[] {
  if (pool.length === 0) {
    return session;
  }

  const have = new Set(session.map((spot) => spot.id));
  if (pool.some((spot) => !have.has(spot.id))) {
    return session;
  }

  const remaining = session.length - Math.max(0, visibleIndex);
  if (remaining > FEED_RECYCLE_REMAINING_ITEMS) {
    return session;
  }

  return [
    ...session,
    ...recycleCycle(pool, session.at(-1)?.id, session.length + pool.length),
  ];
}

export function isFeedSessionAppend<T extends { id: string }>(
  session: T[],
  incoming: T[]
): boolean {
  if (session.length === 0 || incoming.length < session.length) {
    return false;
  }

  const incomingIds = new Set(incoming.map((spot) => spot.id));
  return session.every((spot) => incomingIds.has(spot.id));
}

export function syncFeedSessionSpots<T extends { id: string }>(
  session: T[],
  incoming: T[],
  seenIds: readonly string[]
): T[] {
  if (incoming.length === 0) {
    return session;
  }

  if (session.length === 0) {
    return startFeedSession(incoming, seenIds);
  }

  const incomingById = new Map(incoming.map((spot) => [spot.id, spot]));
  const refreshed = session.map((spot) => incomingById.get(spot.id) ?? spot);
  const have = new Set(session.map((spot) => spot.id));
  const added = incoming.filter((spot) => !have.has(spot.id));
  return [...refreshed, ...excludeSeenSpots(added, seenIds)];
}

export function extendFeedSession<T extends { id: string }>(
  session: T[],
  pool: T[],
  seenIds: readonly string[],
  canLoadMore = false,
  visibleIndex = 0
): T[] {
  if (pool.length === 0) {
    return session;
  }

  const have = new Set(session.map((spot) => spot.id));
  const unseenMissing = excludeSeenSpots(pool, seenIds).filter(
    (spot) => !have.has(spot.id)
  );
  const withUnseen =
    unseenMissing.length > 0 ? [...session, ...unseenMissing] : session;

  const haveAfterUnseen = new Set(withUnseen.map((spot) => spot.id));
  const remainingPool = pool.filter((spot) => !haveAfterUnseen.has(spot.id));
  const withRemaining =
    remainingPool.length > 0 ? [...withUnseen, ...remainingPool] : withUnseen;

  if (canLoadMore) {
    return withRemaining;
  }

  return recycleFeedSpots(withRemaining, pool, visibleIndex);
}

export function unseenSpotCount<T extends { id: string }>(
  spots: T[],
  seenIds: readonly string[]
): number {
  const seen = new Set(seenIds);
  return spots.reduce(
    (count, spot) => (seen.has(spot.id) ? count : count + 1),
    0
  );
}
