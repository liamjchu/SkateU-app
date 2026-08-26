import { getApiUrl } from './api';
import { displayableAvatarUrl } from './avatarUrl';
import { sanitizeErrorMessage } from './userFacingError';
import type { FollowListKind } from './userFollows';
import type { FollowListUser, PublicProfileView } from '../types/publicProfile';
import type { Spot } from '../types/spot';

const REQUEST_TIMEOUT_MS = 10_000;
const LOAD_FAILED_ERROR = 'Couldn’t load that profile right now.';
const FOLLOW_LIST_FAILED_ERROR = 'Couldn’t load that list right now.';
const FOLLOW_FAILED_ERROR = 'Couldn’t follow that skater right now.';
const UNFOLLOW_FAILED_ERROR = 'Couldn’t unfollow that skater right now.';
const SPOTS_FAILED_ERROR = 'Couldn’t load those spots right now.';

async function fetchWithTimeout(
  input: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === 'string' && data.error.length > 0) {
      return sanitizeErrorMessage(data.error, fallback);
    }
  } catch {
    // Body was not JSON.
  }
  return fallback;
}

function authHeaders(accessToken?: string | null): HeadersInit | undefined {
  if (!accessToken) {
    return undefined;
  }

  return { Authorization: `Bearer ${accessToken}` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

export function mapPublicProfileView(value: unknown): PublicProfileView | null {
  if (!isRecord(value) || !isRecord(value.profile)) {
    return null;
  }

  const id =
    typeof value.profile.id === 'string' && value.profile.id.length > 0
      ? value.profile.id
      : null;
  if (!id) {
    return null;
  }

  return {
    id,
    username:
      typeof value.profile.username === 'string' && value.profile.username.length > 0
        ? value.profile.username
        : null,
    avatarUrl: displayableAvatarUrl(
      typeof value.profile.avatarUrl === 'string' ? value.profile.avatarUrl : null
    ),
    bio:
      typeof value.profile.bio === 'string' && value.profile.bio.length > 0
        ? value.profile.bio
        : null,
    followerCount: readCount(value.followerCount),
    followingCount: readCount(value.followingCount),
    isFollowing: value.isFollowing === true,
  };
}

export function mapFollowListUser(value: unknown): FollowListUser | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === 'string' && value.id.length > 0 ? value.id : null;
  if (!id) {
    return null;
  }

  return {
    id,
    username:
      typeof value.username === 'string' && value.username.length > 0
        ? value.username
        : null,
    avatarUrl: displayableAvatarUrl(
      typeof value.avatarUrl === 'string' ? value.avatarUrl : null
    ),
    isFollowing: value.isFollowing === true,
  };
}

export function mapFollowListUsers(value: unknown): FollowListUser[] | null {
  if (!isRecord(value) || !Array.isArray(value.users)) {
    return null;
  }

  const users: FollowListUser[] = [];
  for (const item of value.users) {
    const mapped = mapFollowListUser(item);
    if (!mapped) {
      return null;
    }
    users.push(mapped);
  }
  return users;
}

export function followListUserAsProfile(user: FollowListUser): PublicProfileView {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: null,
    followerCount: 0,
    followingCount: 0,
    isFollowing: user.isFollowing,
  };
}

export function mapFollowStats(
  value: unknown,
  profile: PublicProfileView
): PublicProfileView {
  if (!isRecord(value)) {
    return profile;
  }

  return {
    ...profile,
    followerCount: readCount(value.followerCount),
    followingCount: readCount(value.followingCount),
    isFollowing: value.isFollowing === true,
  };
}

export async function fetchPublicProfileView(
  userId: string,
  accessToken?: string | null
): Promise<PublicProfileView> {
  const response = await fetchWithTimeout(
    getApiUrl(`/api/profiles?userId=${encodeURIComponent(userId)}`),
    {
      method: 'GET',
      headers: authHeaders(accessToken),
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, LOAD_FAILED_ERROR));
  }

  const mapped = mapPublicProfileView((await response.json()) as unknown);
  if (!mapped) {
    throw new Error(LOAD_FAILED_ERROR);
  }

  return mapped;
}

export async function fetchFollowList(
  userId: string,
  list: FollowListKind,
  accessToken?: string | null
): Promise<FollowListUser[]> {
  const response = await fetchWithTimeout(
    getApiUrl(
      `/api/user-follows?userId=${encodeURIComponent(userId)}&list=${encodeURIComponent(list)}`
    ),
    {
      method: 'GET',
      headers: authHeaders(accessToken),
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, FOLLOW_LIST_FAILED_ERROR));
  }

  const mapped = mapFollowListUsers((await response.json()) as unknown);
  if (!mapped) {
    throw new Error(FOLLOW_LIST_FAILED_ERROR);
  }

  return mapped;
}

export async function followUser(
  userId: string,
  accessToken: string,
  current: PublicProfileView
): Promise<PublicProfileView> {
  const response = await fetchWithTimeout(getApiUrl('/api/user-follows'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, FOLLOW_FAILED_ERROR));
  }

  return mapFollowStats((await response.json()) as unknown, {
    ...current,
    isFollowing: true,
  });
}

export async function unfollowUser(
  userId: string,
  accessToken: string,
  current: PublicProfileView
): Promise<PublicProfileView> {
  const response = await fetchWithTimeout(
    getApiUrl(`/api/user-follows?userId=${encodeURIComponent(userId)}`),
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, UNFOLLOW_FAILED_ERROR));
  }

  return mapFollowStats((await response.json()) as unknown, {
    ...current,
    isFollowing: false,
  });
}

export async function fetchCreatorSpots(
  userId: string,
  accessToken?: string | null
): Promise<Spot[]> {
  const response = await fetchWithTimeout(
    getApiUrl(`/api/spots?creatorUserId=${encodeURIComponent(userId)}`),
    {
      method: 'GET',
      headers: authHeaders(accessToken),
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, SPOTS_FAILED_ERROR));
  }

  const data = (await response.json()) as { spots?: Spot[] };
  return Array.isArray(data.spots) ? data.spots : [];
}
