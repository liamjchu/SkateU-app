import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useRecentFeedStore } from '../store/recentFeedStore';
import { useSpotsStore } from '../store/spotsStore';

export function useRecentSpotsFeed() {
  const accessToken = useAuthStore((state) => state.session?.access_token);
  const recentSpots = useSpotsStore((state) => state.recentSpots);
  const isLoading = useRecentFeedStore((state) => state.isLoading);
  const isLoadingMore = useRecentFeedStore((state) => state.isLoadingMore);
  const error = useRecentFeedStore((state) => state.error);
  const hasMore = useRecentFeedStore((state) => state.hasMore);
  const retryNonce = useRecentFeedStore((state) => state.retryNonce);
  const fetchLatest = useRecentFeedStore((state) => state.fetchLatest);
  const loadMore = useRecentFeedStore((state) => state.loadMore);
  const retry = useRecentFeedStore((state) => state.retry);

  useEffect(() => {
    void fetchLatest(accessToken);
  }, [accessToken, fetchLatest, retryNonce]);

  return {
    recentSpots,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore: () => {
      void loadMore(accessToken);
    },
    retry,
    refresh: () => {
      void fetchLatest(accessToken);
    },
  };
}
