import { COMMENT_PAGE_SIZE } from './commentForm';
import type { SpotComment } from '../types/comment';
import type { Profile } from '../types/profile';
import type { School, SchoolType, SchoolTypeFilter } from '../types/school';
import type { Spot } from '../types/spot';
import type { BlockedUser } from '../types/userBlock';

export const SPOTS_CACHE_KEY = '@skateu:spots-cache';
export const SCHOOLS_CACHE_KEY = '@skateu:schools-cache';
export const COMMENTS_CACHE_KEY = '@skateu:comments-cache';
export const PROFILE_CACHE_KEY = '@skateu:profile-cache';
export const BLOCKS_CACHE_KEY = '@skateu:blocks-cache';

export const SCHOOLS_CACHE_CAP = 50;
export const COMMENTS_CACHE_SPOT_CAP = 12;

export const STALE_SPOTS_MESSAGE =
  'Showing last saved spots. Pull to retry.';
export const STALE_COMMENTS_MESSAGE =
  'Showing last saved comments. Pull to retry.';
export const STALE_SCHOOLS_MESSAGE =
  'Showing last saved schools. Pull to retry.';
export const CONNECTION_REQUIRED_SAVE =
  'You need a connection to save this.';

const SCHOOL_TYPES: readonly SchoolType[] = [
  'k12_public',
  'k12_private',
  'higher_ed',
];
const SCHOOL_FILTERS: readonly SchoolTypeFilter[] = [
  'all',
  'k12',
  'college',
  'saved',
];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readPersistedRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function capNewest<T>(items: T[], cap: number): T[] {
  return items.slice(0, Math.max(0, cap));
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export function parseSchool(value: unknown): School | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const name = readString(value.name);
  const lat = readFiniteNumber(value.lat);
  const lng = readFiniteNumber(value.lng);
  const city = readString(value.city);
  const state = readString(value.state);
  const numSpots = readFiniteNumber(value.numSpots);
  if (
    id === null ||
    id.length === 0 ||
    name === null ||
    lat === null ||
    lng === null ||
    city === null ||
    state === null ||
    numSpots === null
  ) {
    return null;
  }

  const type = SCHOOL_TYPES.find((item) => item === value.type);
  const spotImageUrl =
    value.spotImageUrl === null
      ? null
      : readString(value.spotImageUrl) ?? undefined;

  return {
    id,
    name,
    lat,
    lng,
    city,
    state,
    numSpots,
    ...(type ? { type } : {}),
    ...(spotImageUrl !== undefined ? { spotImageUrl } : {}),
  };
}

export function parseSchools(value: unknown): School[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(parseSchool)
    .filter((school): school is School => school !== null);
}

export function parseSchoolFilter(value: unknown): SchoolTypeFilter | null {
  if (typeof value !== 'string') {
    return null;
  }
  return SCHOOL_FILTERS.find((item) => item === value) ?? null;
}

export function parseSpot(value: unknown): Spot | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const name = readString(value.name);
  const description = readString(value.description);
  const latitude = readFiniteNumber(value.latitude);
  const longitude = readFiniteNumber(value.longitude);
  const city = readString(value.city);
  const state = readString(value.state);
  const schoolName = readString(value.schoolName);
  const createdAt = readString(value.createdAt);
  const updatedAt = readString(value.updatedAt);
  if (
    id === null ||
    id.length === 0 ||
    name === null ||
    description === null ||
    latitude === null ||
    longitude === null ||
    city === null ||
    state === null ||
    schoolName === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  const schoolId = readString(value.schoolId);
  const creatorUsername =
    value.creatorUsername === null ? null : readString(value.creatorUsername);
  const creatorUserId =
    value.creatorUserId === null
      ? null
      : readString(value.creatorUserId) ?? undefined;
  const likeCount = readFiniteNumber(value.likeCount);
  const commentCount = readFiniteNumber(value.commentCount);

  return {
    id,
    name,
    description,
    latitude,
    longitude,
    imageUris: readStringArray(value.imageUris),
    city,
    state,
    schoolName,
    createdAt,
    updatedAt,
    creatorUsername,
    ...(schoolId ? { schoolId } : {}),
    ...(creatorUserId !== undefined ? { creatorUserId } : {}),
    ...(likeCount !== null ? { likeCount } : {}),
    ...(typeof value.likedByUser === 'boolean'
      ? { likedByUser: value.likedByUser }
      : {}),
    ...(commentCount !== null ? { commentCount } : {}),
  };
}

export function parseSpots(value: unknown): Spot[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(parseSpot).filter((spot): spot is Spot => spot !== null);
}

function parseComment(value: unknown): SpotComment | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const spotId = readString(value.spotId);
  const content = readString(value.content);
  const createdAt = readString(value.createdAt);
  if (
    id === null ||
    id.length === 0 ||
    spotId === null ||
    content === null ||
    createdAt === null
  ) {
    return null;
  }

  const replies = Array.isArray(value.replies)
    ? value.replies
        .map(parseComment)
        .filter((comment): comment is SpotComment => comment !== null)
    : [];

  return {
    id,
    spotId,
    content,
    createdAt,
    userId: value.userId === null ? null : readString(value.userId),
    parentCommentId:
      value.parentCommentId === null ? null : readString(value.parentCommentId),
    creatorUsername:
      value.creatorUsername === null ? null : readString(value.creatorUsername),
    replies,
  };
}

export type PersistedSpotComments = {
  comments: SpotComment[];
  hasMore: boolean;
  nextOffset: number;
  commentCount: number;
};

export function parsePersistedSpotComments(
  value: unknown
): PersistedSpotComments | null {
  if (!isRecord(value)) {
    return null;
  }

  const comments = Array.isArray(value.comments)
    ? value.comments
        .map(parseComment)
        .filter((comment): comment is SpotComment => comment !== null)
        .slice(0, COMMENT_PAGE_SIZE)
    : [];
  const nextOffset = readFiniteNumber(value.nextOffset);
  const commentCount = readFiniteNumber(value.commentCount);

  return {
    comments,
    hasMore: value.hasMore === true || comments.length >= COMMENT_PAGE_SIZE,
    nextOffset:
      nextOffset !== null && Number.isInteger(nextOffset) && nextOffset >= 0
        ? Math.min(nextOffset, COMMENT_PAGE_SIZE)
        : comments.length,
    commentCount: commentCount !== null ? Math.max(0, commentCount) : comments.length,
  };
}

export function parseProfile(value: unknown): Profile | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  if (id === null || id.length === 0) {
    return null;
  }

  return {
    id,
    username: value.username === null ? null : readString(value.username),
    avatar_url: value.avatar_url === null ? null : readString(value.avatar_url),
    updated_at: value.updated_at === null ? null : readString(value.updated_at),
    legal_version:
      value.legal_version === null ? null : readString(value.legal_version),
    legal_accepted_at:
      value.legal_accepted_at === null
        ? null
        : readString(value.legal_accepted_at),
    age_attested_at:
      value.age_attested_at === null ? null : readString(value.age_attested_at),
  };
}

export function parseBlockedUsers(value: unknown): BlockedUser[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }
    const userId = readString(item.userId);
    if (userId === null || userId.length === 0) {
      return [];
    }
    return [
      {
        userId,
        username: item.username === null ? null : readString(item.username),
      },
    ];
  });
}
