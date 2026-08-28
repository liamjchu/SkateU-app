import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { captureAnalyticsEvent } from '../lib/analytics';
import { getApiUrl } from '../lib/api';
import { getClientStorage } from '../lib/clientStorage';
import { COMMENT_PAGE_SIZE } from '../lib/commentForm';
import {
  COMMENTS_CACHE_KEY,
  COMMENTS_CACHE_SPOT_CAP,
  parsePersistedSpotComments,
  readPersistedRecord,
  type PersistedSpotComments,
} from '../lib/readCache';
import { sanitizeErrorMessage } from '../lib/userFacingError';
import type { SpotComment } from '../types/comment';
import { useSpotsStore } from './spotsStore';

type SpotCommentsCache = {
  comments: SpotComment[];
  loading: boolean;
  loadingMore: boolean;
  submitting: boolean;
  error: string | null;
  hasMore: boolean;
  nextOffset: number;
  commentCount: number;
};

type CommentsState = {
  bySpotId: Record<string, SpotCommentsCache>;
  commentCounts: Record<string, number>;
  recentSpotIds: string[];
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  fetchComments: (spotId: string, accessToken?: string) => Promise<void>;
  fetchMore: (spotId: string, accessToken?: string) => Promise<void>;
  addComment: (
    spotId: string,
    content: string,
    accessToken: string,
    parentCommentId?: string
  ) => Promise<SpotComment>;
  deleteComment: (
    spotId: string,
    commentId: string,
    accessToken: string
  ) => Promise<void>;
  hideUserComments: (userId: string) => void;
  replaceCreatorAvatar: (userId: string, avatarUrl: string | null) => void;
  hideComment: (spotId: string, commentId: string) => void;
  resetSpot: (spotId: string) => void;
  reset: () => void;
};

const REQUEST_TIMEOUT_MS = 10_000;
const MUTATION_TIMEOUT_MS = 60_000;
const LOAD_FAILED_ERROR = 'Couldn’t load comments right now.';
const LOAD_TIMEOUT_ERROR = 'Loading comments timed out. Please try again.';
const POST_TIMEOUT_ERROR = 'Posting this comment timed out. Please try again.';
const ALREADY_POSTING_ERROR = 'Still posting. Please wait.';

const emptyCache = (): SpotCommentsCache => ({
  comments: [],
  loading: false,
  loadingMore: false,
  submitting: false,
  error: null,
  hasMore: false,
  nextOffset: 0,
  commentCount: 0,
});

const fetchVersions = new Map<string, number>();

function bumpVersion(spotId: string): number {
  const next = (fetchVersions.get(spotId) ?? 0) + 1;
  fetchVersions.set(spotId, next);
  return next;
}

function currentVersion(spotId: string): number {
  return fetchVersions.get(spotId) ?? 0;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const responseWithClone = response as unknown as { clone?: () => Response };
    if (typeof responseWithClone.clone === 'function') {
      await responseWithClone.clone().arrayBuffer();
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

const MAX_GET_ATTEMPTS = 3;

function retryDelayMs(attempt: number): number {
  if (process.env.JEST_WORKER_ID !== undefined) {
    return 0;
  }
  return 300 * attempt;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGetWithRetry(
  input: string,
  init: RequestInit,
  maxAttempts: number = MAX_GET_ATTEMPTS
): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetchWithTimeout(input, init);
      if (response.status >= 500 && attempt < maxAttempts) {
        await wait(retryDelayMs(attempt));
        continue;
      }
      return response;
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      if (isTimeout || attempt >= maxAttempts) {
        throw error;
      }
      await wait(retryDelayMs(attempt));
    }
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: string;
      reason?: string;
    };
    if (typeof data.error === 'string' && data.error.length > 0) {
      return sanitizeErrorMessage(data.error, LOAD_FAILED_ERROR);
    }
    if (typeof data.reason === 'string' && data.reason.length > 0) {
      return sanitizeErrorMessage(data.reason, LOAD_FAILED_ERROR);
    }
  } catch {
    // Body was not JSON.
  }

  if (response.status >= 500) {
    return 'The server is temporarily unavailable. Please try again.';
  }
  if (response.status === 401) {
    return 'Log in again to keep going.';
  }
  return `Request failed with status ${response.status}.`;
}

function toFetchErrorMessage(error: unknown, timeoutMessage: string): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return timeoutMessage;
  }
  if (error instanceof Error && error.message.length > 0) {
    return sanitizeErrorMessage(error.message, LOAD_FAILED_ERROR);
  }
  return LOAD_FAILED_ERROR;
}

function patchCache(
  state: CommentsState,
  spotId: string,
  patch: Partial<SpotCommentsCache>
): CommentsState {
  const current = state.bySpotId[spotId] ?? emptyCache();
  return {
    ...state,
    bySpotId: {
      ...state.bySpotId,
      [spotId]: { ...current, ...patch },
    },
  };
}

function applyCommentCount(spotId: string, commentCount: number): void {
  useSpotsStore.getState().setSpotCommentCount(spotId, commentCount);
}

function insertCreatedComment(
  comments: SpotComment[],
  created: SpotComment
): SpotComment[] {
  if (!created.parentCommentId) {
    return [created, ...comments.filter((comment) => comment.id !== created.id)];
  }

  return comments.map((comment) => {
    if (comment.id !== created.parentCommentId) {
      return comment;
    }
    if (comment.replies.some((reply) => reply.id === created.id)) {
      return comment;
    }
    return { ...comment, replies: [...comment.replies, created] };
  });
}

function authHeaders(accessToken?: string): HeadersInit | undefined {
  return accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : undefined;
}

type CommentsPagePayload = {
  comments?: SpotComment[];
  commentCount?: number;
  nextOffset?: unknown;
  hasMore?: unknown;
};

function readPagination(
  data: CommentsPagePayload,
  fallbackOffset: number
): { nextOffset: number; hasMore: boolean } {
  const nextOffset =
    typeof data.nextOffset === 'number' &&
    Number.isInteger(data.nextOffset) &&
    data.nextOffset >= 0
      ? data.nextOffset
      : fallbackOffset;
  return { nextOffset, hasMore: data.hasMore === true };
}

function commentsWithoutUser(
  comments: SpotComment[],
  userId: string
): SpotComment[] {
  return comments
    .filter((comment) => comment.userId !== userId)
    .map((comment) => ({
      ...comment,
      replies: comment.replies.filter((reply) => reply.userId !== userId),
    }));
}

function removeComment(
  comments: SpotComment[],
  commentId: string
): SpotComment[] {
  return comments
    .filter((comment) => comment.id !== commentId)
    .map((comment) => ({
      ...comment,
      replies: comment.replies.filter((reply) => reply.id !== commentId),
    }));
}

function touchRecentSpot(recentSpotIds: string[], spotId: string): string[] {
  return [spotId, ...recentSpotIds.filter((id) => id !== spotId)].slice(
    0,
    COMMENTS_CACHE_SPOT_CAP
  );
}

function persistableBySpotId(
  bySpotId: Record<string, SpotCommentsCache>,
  recentSpotIds: string[]
): Record<string, PersistedSpotComments> {
  const persisted: Record<string, PersistedSpotComments> = {};
  for (const spotId of recentSpotIds) {
    const cache = bySpotId[spotId];
    if (!cache || cache.comments.length === 0) {
      continue;
    }
    persisted[spotId] = {
      comments: cache.comments.slice(0, COMMENT_PAGE_SIZE),
      hasMore: cache.hasMore || cache.comments.length > COMMENT_PAGE_SIZE,
      nextOffset: Math.min(cache.nextOffset, COMMENT_PAGE_SIZE),
      commentCount: cache.commentCount,
    };
  }
  return persisted;
}

export const useCommentsStore = create<CommentsState>()(
  persist(
    (set, get) => ({
  bySpotId: {},
  commentCounts: {},
  recentSpotIds: [],
  hasHydrated: false,
  setHasHydrated: (hasHydrated) => set({ hasHydrated }),

  fetchComments: async (spotId, accessToken) => {
    const version = bumpVersion(spotId);
    const cached = get().bySpotId[spotId];
    const hasCache = (cached?.comments.length ?? 0) > 0;
    set((state) =>
      patchCache(state, spotId, {
        loading: !hasCache,
        error: null,
      })
    );

    try {
      const response = await fetchGetWithRetry(
        getApiUrl(
          `/api/spot-comments?spotId=${encodeURIComponent(spotId)}&offset=0`
        ),
        { headers: authHeaders(accessToken) }
      );

      if (currentVersion(spotId) !== version) {
        return;
      }

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as CommentsPagePayload;
      const comments = data.comments ?? [];
      const commentCount = data.commentCount ?? 0;
      const pagination = readPagination(data, 0);
      applyCommentCount(spotId, commentCount);

      set((state) => {
        const recentSpotIds = touchRecentSpot(state.recentSpotIds, spotId);
        const nextBySpotId = {
          ...state.bySpotId,
          [spotId]: {
            ...(state.bySpotId[spotId] ?? emptyCache()),
            comments,
            loading: false,
            error: null,
            hasMore: pagination.hasMore,
            nextOffset: pagination.nextOffset,
            commentCount,
          },
        };
        for (const id of Object.keys(nextBySpotId)) {
          if (!recentSpotIds.includes(id)) {
            delete nextBySpotId[id];
          }
        }
        const commentCounts = { ...state.commentCounts, [spotId]: commentCount };
        for (const id of Object.keys(commentCounts)) {
          if (!recentSpotIds.includes(id) && id !== spotId) {
            delete commentCounts[id];
          }
        }
        return { bySpotId: nextBySpotId, commentCounts, recentSpotIds };
      });
    } catch (error) {
      if (currentVersion(spotId) !== version) {
        return;
      }

      set((state) =>
        patchCache(state, spotId, {
          loading: false,
          error: toFetchErrorMessage(error, LOAD_TIMEOUT_ERROR),
        })
      );
    }
  },

  fetchMore: async (spotId, accessToken) => {
    const cache = get().bySpotId[spotId] ?? emptyCache();
    if (cache.loading || cache.loadingMore || !cache.hasMore) {
      return;
    }

    const version = currentVersion(spotId);
    set((state) => patchCache(state, spotId, { loadingMore: true, error: null }));

    try {
      const response = await fetchGetWithRetry(
        getApiUrl(
          `/api/spot-comments?spotId=${encodeURIComponent(spotId)}&offset=${cache.nextOffset}`
        ),
        { headers: authHeaders(accessToken) }
      );

      if (currentVersion(spotId) !== version) {
        return;
      }

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as CommentsPagePayload;
      const page = data.comments ?? [];
      const commentCount = data.commentCount ?? cache.commentCount;
      const pagination = readPagination(data, cache.nextOffset);
      applyCommentCount(spotId, commentCount);

      set((state) => {
        const current = state.bySpotId[spotId] ?? emptyCache();
        const existingIds = new Set(current.comments.map((comment) => comment.id));
        const merged = [
          ...current.comments,
          ...page.filter((comment) => !existingIds.has(comment.id)),
        ];
        return {
          ...patchCache(state, spotId, {
            comments: merged,
            loadingMore: false,
            hasMore: pagination.hasMore,
            nextOffset: pagination.nextOffset,
            commentCount,
          }),
          commentCounts: { ...state.commentCounts, [spotId]: commentCount },
        };
      });
    } catch (error) {
      if (currentVersion(spotId) !== version) {
        return;
      }
      set((state) =>
        patchCache(state, spotId, {
          loadingMore: false,
          error: toFetchErrorMessage(error, LOAD_TIMEOUT_ERROR),
        })
      );
    }
  },

  addComment: async (spotId, content, accessToken, parentCommentId) => {
    const cache = get().bySpotId[spotId] ?? emptyCache();
    if (cache.submitting) {
      throw new Error(ALREADY_POSTING_ERROR);
    }

    set((state) => patchCache(state, spotId, { submitting: true }));

    try {
      const response = await fetchWithTimeout(
        getApiUrl('/api/spot-comments'),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            spotId,
            content,
            parentCommentId,
          }),
        },
        MUTATION_TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as {
        comment?: SpotComment;
        commentCount?: number;
      };
      if (!data.comment) {
        throw new Error('The server did not return the comment.');
      }

      const created: SpotComment = { ...data.comment, replies: data.comment.replies ?? [] };
      const commentCount = data.commentCount ?? cache.commentCount + 1;
      captureAnalyticsEvent('comment_posted', { spot_id: spotId });
      applyCommentCount(spotId, commentCount);

      set((state) => {
        const current = state.bySpotId[spotId] ?? emptyCache();
        return {
          ...patchCache(state, spotId, {
            comments: insertCreatedComment(current.comments, created),
            submitting: false,
            commentCount,
          }),
          commentCounts: { ...state.commentCounts, [spotId]: commentCount },
        };
      });

      return created;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        set((state) => patchCache(state, spotId, { submitting: false }));
        throw new Error(POST_TIMEOUT_ERROR);
      }
      set((state) => patchCache(state, spotId, { submitting: false }));
      throw error;
    }
  },

  deleteComment: async (spotId, commentId, accessToken) => {
    const response = await fetchWithTimeout(
      getApiUrl(`/api/spot-comments?id=${encodeURIComponent(commentId)}`),
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const data = (await response.json()) as { commentCount?: number };
    captureAnalyticsEvent('comment_deleted', { spot_id: spotId });
    const current = get().bySpotId[spotId] ?? emptyCache();
    const commentCount = data.commentCount ?? Math.max(0, current.commentCount - 1);
    applyCommentCount(spotId, commentCount);

    set((state) => {
      const cache = state.bySpotId[spotId] ?? emptyCache();
      return {
        ...patchCache(state, spotId, {
          comments: removeComment(cache.comments, commentId),
          commentCount,
        }),
        commentCounts: { ...state.commentCounts, [spotId]: commentCount },
      };
    });
  },

  hideUserComments: (userId) => {
    set((state) => {
      const bySpotId = { ...state.bySpotId };
      for (const [spotId, cache] of Object.entries(bySpotId)) {
        bySpotId[spotId] = {
          ...cache,
          comments: commentsWithoutUser(cache.comments, userId),
        };
      }
      return { bySpotId };
    });
  },

  replaceCreatorAvatar: (userId, avatarUrl) => {
    const replace = (comment: SpotComment): SpotComment => {
      const next =
        comment.userId === userId
          ? { ...comment, creatorAvatarUrl: avatarUrl }
          : comment;
      return {
        ...next,
        replies: next.replies.map(replace),
      };
    };

    set((state) => {
      const bySpotId: Record<string, SpotCommentsCache> = {};
      for (const [spotId, cache] of Object.entries(state.bySpotId)) {
        bySpotId[spotId] = {
          ...cache,
          comments: cache.comments.map(replace),
        };
      }
      return { bySpotId };
    });
  },

  hideComment: (spotId, commentId) => {
    const cache = get().bySpotId[spotId];
    if (!cache) {
      return;
    }
    set((state) =>
      patchCache(state, spotId, {
        comments: removeComment(cache.comments, commentId),
      })
    );
  },

  resetSpot: (spotId) => {
    bumpVersion(spotId);
    set((state) => {
      const nextBySpotId = { ...state.bySpotId };
      delete nextBySpotId[spotId];
      const nextCounts = { ...state.commentCounts };
      delete nextCounts[spotId];
      return { bySpotId: nextBySpotId, commentCounts: nextCounts };
    });
  },

  reset: () => {
    fetchVersions.clear();
    set({ bySpotId: {}, commentCounts: {}, recentSpotIds: [] });
  },
    }),
    {
      name: COMMENTS_CACHE_KEY,
      storage: createJSONStorage(getClientStorage),
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useCommentsStore.getState().setHasHydrated(true);
      },
      partialize: (state) => ({
        recentSpotIds: state.recentSpotIds,
        commentCounts: state.commentCounts,
        bySpotId: persistableBySpotId(state.bySpotId, state.recentSpotIds),
      }),
      merge: (persistedState, currentState) => {
        const persisted = readPersistedRecord(persistedState);
        const recentSpotIds = Array.isArray(persisted.recentSpotIds)
          ? persisted.recentSpotIds.filter(
              (id): id is string => typeof id === 'string'
            ).slice(0, COMMENTS_CACHE_SPOT_CAP)
          : [];
        const persistedBySpot = readPersistedRecord(persisted.bySpotId);
        const bySpotId: Record<string, SpotCommentsCache> = {};
        const commentCounts: Record<string, number> = {};

        for (const spotId of recentSpotIds) {
          const parsed = parsePersistedSpotComments(persistedBySpot[spotId]);
          if (!parsed) {
            continue;
          }
          bySpotId[spotId] = {
            ...emptyCache(),
            ...parsed,
          };
          commentCounts[spotId] = parsed.commentCount;
        }

        return {
          ...currentState,
          bySpotId,
          commentCounts,
          recentSpotIds,
        };
      },
    }
  )
);
