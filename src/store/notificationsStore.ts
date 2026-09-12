import { create } from 'zustand';
import { getApiUrl } from '../lib/api';
import {
  mapNotificationView,
  parseUnreadCount,
} from '../lib/notifications';
import { sanitizeErrorMessage } from '../lib/userFacingError';
import type { UserNotification } from '../types/notification';

type NotificationsState = {
  userId: string | null;
  items: UserNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  syncUser: (userId: string | null) => void;
  fetchUnreadCount: (accessToken: string, signal?: AbortSignal) => Promise<void>;
  fetchNotifications: (accessToken: string) => Promise<void>;
  markAllRead: (accessToken: string) => Promise<void>;
  hideNotification: (id: string, accessToken: string) => Promise<void>;
  hideActorNotifications: (userId: string) => void;
  clear: () => void;
};

const REQUEST_TIMEOUT_MS = 10_000;
const LOAD_FAILED_ERROR = 'Couldn’t load notifications right now.';
const HIDE_FAILED_ERROR = 'Couldn’t hide that notification right now.';

let unreadInFlight: Promise<void> | null = null;
let unreadEpoch = 0;

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function abortError(): Error {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  externalSignal?: AbortSignal
): Promise<Response> {
  if (externalSignal?.aborted) {
    throw abortError();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    const responseWithClone = response as unknown as { clone?: () => Response };
    if (typeof responseWithClone.clone === 'function') {
      await responseWithClone.clone().arrayBuffer();
    }
    return response;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', onAbort);
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

function timeoutMessage(error: unknown, fallback: string): string {
  if (isAbortError(error)) {
    return 'This is taking too long. Please try again.';
  }
  return sanitizeErrorMessage(
    error instanceof Error ? error.message : '',
    fallback
  );
}

function parseNotificationsPayload(payload: unknown): {
  items: UserNotification[];
  unreadCount: number;
} {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { items: [], unreadCount: 0 };
  }
  const record = payload as { notifications?: unknown; unreadCount?: unknown };
  const items = Array.isArray(record.notifications)
    ? record.notifications
        .map(mapNotificationView)
        .filter((item): item is UserNotification => item !== null)
    : [];
  return {
    items,
    unreadCount: parseUnreadCount(record.unreadCount),
  };
}

export const useNotificationsStore = create<NotificationsState>()((set, get) => ({
  userId: null,
  items: [],
  unreadCount: 0,
  loading: false,
  error: null,

  syncUser: (userId) => {
    if (get().userId === userId) {
      return;
    }
    unreadEpoch += 1;
    unreadInFlight = null;
    set({
      userId,
      items: [],
      unreadCount: 0,
      loading: false,
      error: null,
    });
  },

  fetchUnreadCount: async (accessToken, signal) => {
    if (unreadInFlight && !signal) {
      return unreadInFlight;
    }

    const epoch = unreadEpoch;
    const request = (async () => {
      try {
        const response = await fetchWithTimeout(
          getApiUrl('/api/notifications?unreadCount=1'),
          { headers: { Authorization: `Bearer ${accessToken}` } },
          signal
        );
        if (epoch !== unreadEpoch) {
          return;
        }
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, LOAD_FAILED_ERROR));
        }
        const payload = (await response.json()) as unknown;
        if (epoch !== unreadEpoch) {
          return;
        }
        set({ unreadCount: parseNotificationsPayload(payload).unreadCount });
      } catch {
        // Keep the last known unread count on a failed refresh.
      }
    })();

    unreadInFlight = request;
    try {
      await request;
    } finally {
      if (unreadInFlight === request) {
        unreadInFlight = null;
      }
    }
  },

  fetchNotifications: async (accessToken) => {
    const hasItems = get().items.length > 0;
    set({ loading: !hasItems, error: null });
    try {
      const response = await fetchWithTimeout(getApiUrl('/api/notifications'), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, LOAD_FAILED_ERROR));
      }
      const payload = (await response.json()) as unknown;
      const parsed = parseNotificationsPayload(payload);
      set({
        items: parsed.items,
        unreadCount: parsed.unreadCount,
        loading: false,
        error: null,
      });
    } catch (error) {
      if (isAbortError(error) && get().items.length === 0) {
        set({ loading: false, error: null, unreadCount: 0 });
        return;
      }
      set({
        loading: false,
        error: timeoutMessage(error, LOAD_FAILED_ERROR),
      });
    }
  },

  markAllRead: async (accessToken) => {
    const previous = get().unreadCount;
    set({ unreadCount: 0 });
    try {
      const response = await fetchWithTimeout(getApiUrl('/api/notifications'), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, LOAD_FAILED_ERROR));
      }
    } catch (error) {
      set({ unreadCount: previous });
      throw new Error(timeoutMessage(error, LOAD_FAILED_ERROR));
    }
  },

  hideNotification: async (id, accessToken) => {
    const previousItems = get().items;
    const previousUnread = get().unreadCount;
    const hidden = previousItems.find((item) => item.id === id);
    if (!hidden) {
      return;
    }

    set({
      items: previousItems.filter((item) => item.id !== id),
      unreadCount:
        hidden.readAt === null
          ? Math.max(0, previousUnread - 1)
          : previousUnread,
      error: null,
    });

    try {
      const response = await fetchWithTimeout(
        getApiUrl(`/api/notifications?id=${encodeURIComponent(id)}`),
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, HIDE_FAILED_ERROR));
      }
    } catch (error) {
      set({
        items: previousItems,
        unreadCount: previousUnread,
      });
      throw new Error(timeoutMessage(error, HIDE_FAILED_ERROR));
    }
  },

  hideActorNotifications: (userId) => {
    const { items, unreadCount } = get();
    const removedUnread = items.filter(
      (item) => item.actorId === userId && item.readAt === null
    ).length;
    set({
      items: items.filter((item) => item.actorId !== userId),
      unreadCount: Math.max(0, unreadCount - removedUnread),
    });
  },

  clear: () => {
    unreadEpoch += 1;
    unreadInFlight = null;
    set({
      userId: null,
      items: [],
      unreadCount: 0,
      loading: false,
      error: null,
    });
  },
}));
