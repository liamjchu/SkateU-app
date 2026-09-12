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
  if (!isFeedSessionAppend(session, incoming)) {
    return excludeSeenSpots(incoming, seenIds);
  }

  const incomingById = new Map(incoming.map((spot) => [spot.id, spot]));
  const refreshed = session.map((spot) => incomingById.get(spot.id) ?? spot);
  const have = new Set(session.map((spot) => spot.id));
  const added = incoming.filter((spot) => !have.has(spot.id));
  return [...refreshed, ...excludeSeenSpots(added, seenIds)];
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
