import { create } from 'zustand';
import { captureAnalyticsEvent } from '../lib/analytics';
import { getApiUrl } from '../lib/api';
import { sanitizeErrorMessage } from '../lib/userFacingError';
import type { BlockedUser } from '../types/userBlock';
import { useCommentsStore } from './commentsStore';
import { useSpotsStore } from './spotsStore';

type BlocksState = {
  users: BlockedUser[];
  loading: boolean;
  error: string | null;
  fetchBlocks: (accessToken: string) => Promise<void>;
  blockUser: (
    userId: string,
    accessToken: string,
    username?: string | null
  ) => Promise<void>;
  unblockUser: (userId: string, accessToken: string) => Promise<void>;
  isBlocked: (userId: string) => boolean;
  clear: () => void;
};

const REQUEST_TIMEOUT_MS = 10_000;
const LOAD_FAILED_ERROR = 'Couldn’t load blocked accounts right now.';

async function fetchWithTimeout(
  input: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === 'string' && data.error.length > 0) {
      return sanitizeErrorMessage(data.error, LOAD_FAILED_ERROR);
    }
  } catch {
    // Body was not JSON.
  }
  return `Request failed with status ${response.status}.`;
}

function hideBlockedContent(userId: string): void {
  useSpotsStore.getState().hideCreatorSpots(userId);
  useCommentsStore.getState().hideUserComments(userId);
}

export const useBlocksStore = create<BlocksState>((set, get) => ({
  users: [],
  loading: false,
  error: null,

  fetchBlocks: async (accessToken) => {
    set({ loading: true, error: null });
    try {
      const response = await fetchWithTimeout(getApiUrl('/api/user-blocks'), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = (await response.json()) as { users?: BlockedUser[] };
      set({ users: data.users ?? [], loading: false, error: null });
    } catch (error) {
      set({
        loading: false,
        error:
          error instanceof Error && error.name === 'AbortError'
            ? 'Loading blocked accounts timed out. Please try again.'
            : sanitizeErrorMessage(
                error instanceof Error ? error.message : '',
                LOAD_FAILED_ERROR
              ),
      });
    }
  },

  blockUser: async (userId, accessToken, username) => {
    const response = await fetchWithTimeout(getApiUrl('/api/user-blocks'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const data = (await response.json()) as { user?: BlockedUser };
    const blocked: BlockedUser = data.user ?? {
      userId,
      username: username ?? null,
    };
    hideBlockedContent(userId);
    captureAnalyticsEvent('user_blocked', { blocked_user_id: userId });
    set((state) => ({
      users: state.users.some((user) => user.userId === userId)
        ? state.users
        : [blocked, ...state.users],
      error: null,
    }));
  },

  unblockUser: async (userId, accessToken) => {
    const response = await fetchWithTimeout(
      getApiUrl(`/api/user-blocks?userId=${encodeURIComponent(userId)}`),
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    captureAnalyticsEvent('user_unblocked', { blocked_user_id: userId });
    set((state) => ({
      users: state.users.filter((user) => user.userId !== userId),
    }));
  },

  isBlocked: (userId) => get().users.some((user) => user.userId === userId),

  clear: () => {
    set({ users: [], loading: false, error: null });
  },
}));
