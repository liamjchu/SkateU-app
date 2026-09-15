import { create } from 'zustand';
import { getApiUrl } from '../lib/api';
import { hasMoreFeedPage } from '../lib/homeFeed';
import { toUserFacingError } from '../lib/userFacingError';
import type { Spot } from '../types/spot';
import { useSpotsStore } from './spotsStore';

type RecentSpotsResponse = {
  spots: Spot[];
};

function recentSpotsAuthHeaders(accessToken?: string): HeadersInit | undefined {
  return accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : undefined;
}

type RecentFeedState = {
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string;
  hasMore: boolean;
  retryNonce: number;
  fetchLatest: (accessToken?: string) => Promise<void>;
  loadMore: (accessToken?: string) => Promise<void>;
  retry: () => void;
};

let abortController: AbortController | null = null;
let fetchGeneration = 0;
let loadMoreLock = false;
let pendingLoadMore = false;
let nextOffset = 0;

export const useRecentFeedStore = create<RecentFeedState>((set, get) => ({
  isLoading: true,
  isLoadingMore: false,
  error: '',
  hasMore: true,
  retryNonce: 0,
  retry: () => {
    set((state) => ({
      error: '',
      retryNonce: state.retryNonce + 1,
    }));
  },
  fetchLatest: async (accessToken) => {
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;
    const generation = ++fetchGeneration;
    loadMoreLock = false;
    pendingLoadMore = false;
    nextOffset = 0;
    set({ isLoading: true, isLoadingMore: false, hasMore: true });

    try {
      const response = await fetch(getApiUrl('/api/spots?recent=1'), {
        signal: controller.signal,
        headers: recentSpotsAuthHeaders(accessToken),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          errorData?.error ?? `Recent spots failed with status ${response.status}`
        );
      }

      const data = (await response.json()) as RecentSpotsResponse;
      const page = data.spots ?? [];

      if (controller.signal.aborted || generation !== fetchGeneration) {
        return;
      }

      useSpotsStore.getState().setRecentFeed('all', page);
      nextOffset = page.length;
      set({
        hasMore: hasMoreFeedPage(page.length),
        error: '',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      if (controller.signal.aborted || generation !== fetchGeneration) {
        return;
      }

      set({
        error: toUserFacingError(error, 'Couldn’t load recent spots right now.'),
      });
    } finally {
      if (generation === fetchGeneration) {
        set({ isLoading: false });
        if (pendingLoadMore) {
          pendingLoadMore = false;
          void get().loadMore(accessToken);
        }
      }
    }
  },
  loadMore: async (accessToken) => {
    const { isLoading, isLoadingMore, hasMore } = get();
    if (isLoading) {
      pendingLoadMore = true;
      return;
    }
    if (loadMoreLock || isLoadingMore || !hasMore) {
      return;
    }

    let controller = abortController;
    if (!controller || controller.signal.aborted) {
      controller = new AbortController();
      abortController = controller;
    }

    loadMoreLock = true;
    set({ isLoadingMore: true });

    try {
      const current = useSpotsStore.getState().recentSpots;
      const response = await fetch(
        getApiUrl(`/api/spots?recent=1&offset=${nextOffset}`),
        {
          signal: controller.signal,
          headers: recentSpotsAuthHeaders(accessToken),
        }
      );

      if (!response.ok) {
        throw new Error('Couldn’t load more recent spots right now.');
      }

      const data = (await response.json()) as RecentSpotsResponse;
      const page = data.spots ?? [];

      if (controller.signal.aborted) {
        return;
      }

      const seen = new Set(current.map((spot) => spot.id));
      const uniqueNew = page.filter((spot) => !seen.has(spot.id));
      useSpotsStore.getState().setRecentFeed('all', [
        ...current,
        ...uniqueNew,
      ]);
      nextOffset += page.length;
      set({
        hasMore: hasMoreFeedPage(page.length),
        error: '',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      if (!controller.signal.aborted) {
        set({
          hasMore: false,
          error: toUserFacingError(
            error,
            'Couldn’t load more recent spots right now.'
          ),
        });
      }
    } finally {
      loadMoreLock = false;
      set({ isLoadingMore: false });
    }
  },
}));
