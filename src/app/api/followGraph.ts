import { displayableAvatarUrl } from '../../lib/avatarUrl';
import type { FollowListKind } from '../../lib/userFollows';
import type { FollowListUser } from '../../types/publicProfile';

type SupabaseConfig = { url: string; apiKey: string };

const FOLLOW_LIST_LIMIT = 100;

export type FollowStats = {
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
};

function supabaseHeaders(config: SupabaseConfig): HeadersInit {
  return {
    apikey: config.apiKey,
    Authorization: `Bearer ${config.apiKey}`,
  };
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

async function countFollows(
  config: SupabaseConfig,
  column: 'follower_id' | 'following_id',
  userId: string
): Promise<number> {
  const query = new URL(`${config.url}/rest/v1/user_follows`);
  query.searchParams.set(column, `eq.${userId}`);
  query.searchParams.set('select', 'follower_id');

  const response = await fetch(query.toString(), {
    headers: {
      ...supabaseHeaders(config),
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(await response.text());
  }

  return parseExactCount(response);
}

export async function hasBlockEitherWay(
  config: SupabaseConfig,
  userA: string,
  userB: string
): Promise<boolean> {
  if (userA === userB) {
    return false;
  }

  const query = new URL(`${config.url}/rest/v1/user_blocks`);
  query.searchParams.set(
    'or',
    `(and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA}))`
  );
  query.searchParams.set('select', 'blocker_id');
  query.searchParams.set('limit', '1');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

export async function isFollowingUser(
  config: SupabaseConfig,
  followerId: string,
  followingId: string
): Promise<boolean> {
  const query = new URL(`${config.url}/rest/v1/user_follows`);
  query.searchParams.set('follower_id', `eq.${followerId}`);
  query.searchParams.set('following_id', `eq.${followingId}`);
  query.searchParams.set('select', 'follower_id');
  query.searchParams.set('limit', '1');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

export async function fetchFollowStats(
  config: SupabaseConfig,
  profileUserId: string,
  viewerId: string | null
): Promise<FollowStats> {
  const [followerCount, followingCount, isFollowing] = await Promise.all([
    countFollows(config, 'following_id', profileUserId),
    countFollows(config, 'follower_id', profileUserId),
    viewerId && viewerId !== profileUserId
      ? isFollowingUser(config, viewerId, profileUserId)
      : Promise.resolve(false),
  ]);

  return { followerCount, followingCount, isFollowing };
}

async function fetchEitherWayBlockedUserIds(
  config: SupabaseConfig,
  viewerId: string
): Promise<Set<string>> {
  const query = new URL(`${config.url}/rest/v1/user_blocks`);
  query.searchParams.set(
    'or',
    `(blocker_id.eq.${viewerId},blocked_id.eq.${viewerId})`
  );
  query.searchParams.set('select', 'blocker_id,blocked_id');

  const response = await fetch(query.toString(), {
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
    if (row.blocker_id === viewerId && typeof row.blocked_id === 'string') {
      ids.add(row.blocked_id);
    } else if (row.blocked_id === viewerId && typeof row.blocker_id === 'string') {
      ids.add(row.blocker_id);
    }
  }
  return ids;
}

async function fetchFollowListProfiles(
  config: SupabaseConfig,
  userIds: string[]
): Promise<Map<string, { username: string | null; avatarUrl: string | null }>> {
  const profiles = new Map<
    string,
    { username: string | null; avatarUrl: string | null }
  >();
  if (userIds.length === 0) {
    return profiles;
  }

  const query = new URL(`${config.url}/rest/v1/profiles`);
  query.searchParams.set('id', `in.(${userIds.join(',')})`);
  query.searchParams.set('select', 'id,username,avatar_url');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as {
    id?: string;
    username?: string | null;
    avatar_url?: string | null;
  }[];
  for (const row of rows) {
    if (typeof row.id !== 'string' || row.id.length === 0) {
      continue;
    }
    profiles.set(row.id, {
      username:
        typeof row.username === 'string' && row.username.length > 0
          ? row.username
          : null,
      avatarUrl: displayableAvatarUrl(
        typeof row.avatar_url === 'string' ? row.avatar_url : null
      ),
    });
  }
  return profiles;
}

async function fetchFollowingSet(
  config: SupabaseConfig,
  viewerId: string,
  targetIds: string[]
): Promise<Set<string>> {
  const following = new Set<string>();
  if (targetIds.length === 0) {
    return following;
  }

  const query = new URL(`${config.url}/rest/v1/user_follows`);
  query.searchParams.set('follower_id', `eq.${viewerId}`);
  query.searchParams.set('following_id', `in.(${targetIds.join(',')})`);
  query.searchParams.set('select', 'following_id');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as { following_id?: string }[];
  for (const row of rows) {
    if (typeof row.following_id === 'string') {
      following.add(row.following_id);
    }
  }
  return following;
}

export async function fetchFollowListUsers(
  config: SupabaseConfig,
  profileUserId: string,
  list: FollowListKind,
  viewerId: string | null
): Promise<FollowListUser[]> {
  const idColumn = list === 'followers' ? 'follower_id' : 'following_id';
  const filterColumn = list === 'followers' ? 'following_id' : 'follower_id';

  const query = new URL(`${config.url}/rest/v1/user_follows`);
  query.searchParams.set(filterColumn, `eq.${profileUserId}`);
  query.searchParams.set('select', `${idColumn},created_at`);
  query.searchParams.set('order', 'created_at.desc');
  query.searchParams.set('limit', String(FOLLOW_LIST_LIMIT));

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as Record<string, unknown>[];
  const orderedIds = rows
    .map((row) => row[idColumn])
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (orderedIds.length === 0) {
    return [];
  }

  const blockedIds = viewerId
    ? await fetchEitherWayBlockedUserIds(config, viewerId)
    : new Set<string>();
  const visibleIds = orderedIds.filter((id) => !blockedIds.has(id));
  if (visibleIds.length === 0) {
    return [];
  }

  const followTargets = viewerId
    ? visibleIds.filter((id) => id !== viewerId)
    : [];
  const [profiles, followingSet] = await Promise.all([
    fetchFollowListProfiles(config, visibleIds),
    viewerId
      ? fetchFollowingSet(config, viewerId, followTargets)
      : Promise.resolve(new Set<string>()),
  ]);

  return visibleIds.map((id) => {
    const profile = profiles.get(id);
    return {
      id,
      username: profile?.username ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      isFollowing:
        viewerId !== null && id !== viewerId && followingSet.has(id),
    };
  });
}

export async function deleteFollowsBothWays(
  config: SupabaseConfig,
  userA: string,
  userB: string
): Promise<void> {
  if (userA === userB) {
    return;
  }

  const query = new URL(`${config.url}/rest/v1/user_follows`);
  query.searchParams.set(
    'or',
    `(and(follower_id.eq.${userA},following_id.eq.${userB}),and(follower_id.eq.${userB},following_id.eq.${userA}))`
  );

  const response = await fetch(query.toString(), {
    method: 'DELETE',
    headers: supabaseHeaders(config),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}
