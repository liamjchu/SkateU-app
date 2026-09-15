import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from '../../components/FeedbackPressable';
import HomeSpotPost from '../../components/home-spot-post';
import LoginRequiredModal from '../../components/LoginRequiredModal';
import SpotFullscreenViewer from '../../components/spot-fullscreen-viewer';
import StaleCacheBanner from '../../components/StaleCacheBanner';
import { colors } from '../../constants/colors';
import { useRecentSpotsFeed } from '../../hooks/useRecentSpotsFeed';
import { useFeedPrefetch } from '../../hooks/useFeedPrefetch';
import { captureAnalyticsEvent } from '../../lib/analytics';
import { FEED_DECELERATION_RATE, feedPageHeight } from '../../lib/feedPaging';
import {
  extendFeedSession,
  startFeedSession,
  syncFeedSessionSpots,
  unseenSpotCount,
} from '../../lib/feedSeen';
import { openSpotOnMap } from '../../lib/mapNavigation';
import { STALE_SPOTS_MESSAGE } from '../../lib/readCache';
import { HOME_SPOTS_PAGE_SIZE, shouldPrefetchMoreItems } from '../../lib/homeFeed';
import { toMutationError } from '../../lib/userFacingError';
import { guardedNavigate, useGuardedRouter } from '../../lib/navigationGuard';
import { useAuthStore } from '../../store/authStore';
import { useCommentsStore } from '../../store/commentsStore';
import { useFeedSeenStore } from '../../store/feedSeenStore';
import { useSpotsStore } from '../../store/spotsStore';
import type { Spot } from '../../types/spot';

export default function FeedScreen() {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const session = useAuthStore((state) => state.session);
  const toggleSpotLike = useSpotsStore((state) => state.toggleSpotLike);
  const commentCounts = useCommentsStore((state) => state.commentCounts);
  const seenSpotIds = useFeedSeenStore((state) => state.seenSpotIds);
  const hasHydratedSeen = useFeedSeenStore((state) => state.hasHydrated);
  const markSeen = useFeedSeenStore((state) => state.markSeen);
  const {
    recentSpots,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    retry,
  } = useRecentSpotsFeed();
  const seenSpotIdsRef = useRef(seenSpotIds);
  seenSpotIdsRef.current = seenSpotIds;
  const recentSpotsRef = useRef(recentSpots);
  recentSpotsRef.current = recentSpots;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const visibleIndexRef = useRef(0);
  const sessionCountRef = useRef(0);
  const feedNearEndRef = useRef(false);
  const [sessionSpots, setSessionSpots] = useState<Spot[]>(() =>
    startFeedSession(recentSpots, useFeedSeenStore.getState().seenSpotIds)
  );
  const [listHeight, setListHeight] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showLoginRequired, setShowLoginRequired] = useState(false);
  const [fullscreenSpotId, setFullscreenSpotId] = useState<string | null>(null);
  const [fullscreenPhotoIndex, setFullscreenPhotoIndex] = useState(0);
  const [commentsCoveringViewer, setCommentsCoveringViewer] = useState(false);

  const pageHeight =
    listHeight > 0 ? listHeight : feedPageHeight(windowHeight, insets.bottom);
  sessionCountRef.current = sessionSpots.length;

  const refillSession = useCallback((current: Spot[]) => {
    const pool = recentSpotsRef.current;
    const seenIds = seenSpotIdsRef.current;
    const base =
      current.length === 0 ? startFeedSession(pool, seenIds) : current;
    const next = extendFeedSession(
      base,
      pool,
      seenIds,
      hasMoreRef.current,
      visibleIndexRef.current
    );
    if (
      next.length === current.length &&
      next.every((spot, index) => spot === current[index])
    ) {
      return current;
    }
    return next;
  }, []);

  const handleNeedMore = useCallback(() => {
    setSessionSpots((current) => refillSession(current));

    if (hasMoreRef.current) {
      loadMore();
    }
  }, [loadMore, refillSession]);

  const noteVisibleIndex = useCallback(
    (index: number) => {
      visibleIndexRef.current = index;
      const nearEnd = shouldPrefetchMoreItems(index, sessionCountRef.current);
      if (nearEnd && !feedNearEndRef.current) {
        handleNeedMore();
      }
      feedNearEndRef.current = nearEnd;
    },
    [handleNeedMore]
  );

  const handleVisibleItems = useCallback(
    (items: { item?: Spot; isViewable?: boolean; index?: number | null }[]) => {
      for (const token of items) {
        if (token.isViewable && token.item?.id) {
          markSeen(token.item.id);
          if (typeof token.index === 'number') {
            noteVisibleIndex(token.index);
          }
        }
      }
    },
    [markSeen, noteVisibleIndex]
  );

  const { onViewableItemsChanged, viewabilityConfig } = useFeedPrefetch(
    sessionSpots.length,
    handleNeedMore,
    handleVisibleItems
  );

  useEffect(() => {
    setSessionSpots((current) =>
      refillSession(
        syncFeedSessionSpots(current, recentSpots, seenSpotIdsRef.current)
      )
    );
    feedNearEndRef.current = false;
  }, [hasMore, recentSpots, refillSession]);

  useEffect(() => {
    setSessionSpots((current) => refillSession(current));
    feedNearEndRef.current = false;
  }, [refillSession, sessionSpots.length]);

  useEffect(() => {
    if (!hasHydratedSeen) {
      return;
    }

    setSessionSpots((current) => {
      if (visibleIndexRef.current > 0 && current.length > 0) {
        return refillSession(current);
      }

      return refillSession(
        startFeedSession(recentSpotsRef.current, seenSpotIdsRef.current)
      );
    });
  }, [hasHydratedSeen, refillSession]);

  useFocusEffect(
    useCallback(() => {
      setCommentsCoveringViewer(false);
    }, [])
  );

  useEffect(() => {
    if (
      unseenSpotCount(recentSpots, seenSpotIds) >= HOME_SPOTS_PAGE_SIZE ||
      !hasMore ||
      isLoading ||
      isLoadingMore
    ) {
      return;
    }

    loadMore();
  }, [
    hasMore,
    isLoading,
    isLoadingMore,
    loadMore,
    recentSpots,
    seenSpotIds,
  ]);

  useEffect(() => {
    if (!isRefreshing) {
      return;
    }

    if (!isLoading) {
      setIsRefreshing(false);
    }
  }, [isLoading, isRefreshing]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    retry();
  };

  const handleLikeSpot = async (spot: Spot) => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setShowLoginRequired(true);
      return;
    }

    try {
      await toggleSpotLike(spot.id, spot.likedByUser === true, accessToken);
    } catch (caught) {
      Alert.alert(
        'Couldn’t update that like',
        toMutationError(caught, 'Please try again.')
      );
    }
  };

  const handleOpenComments = (spot: Spot) => {
    if (fullscreenSpotId !== null) {
      setCommentsCoveringViewer(true);
    }
    guardedNavigate(`comments:${spot.id}`, () => {
      router.push({
        pathname: '/spot-comments',
        params: { spotId: spot.id, spotName: spot.name },
      });
    });
  };

  const handleOpenFullscreen = (spot: Spot, photoIndex = 0) => {
    captureAnalyticsEvent('spot_opened', {
      spot_id: spot.id,
      ...(spot.schoolId ? { school_id: spot.schoolId } : {}),
    });
    setFullscreenPhotoIndex(photoIndex);
    setFullscreenSpotId(spot.id);
  };

  const handleViewMap = (spot: Spot) => {
    if (!openSpotOnMap(router, spot)) {
      Alert.alert(
        'Campus map unavailable',
        'This spot is not tied to a campus, so there is no map to open.'
      );
    }
  };

  const handleViewMapFromFullscreen = (spot: Spot) => {
    setFullscreenSpotId(null);
    handleViewMap(spot);
  };

  const viewerSpots = useMemo(
    () =>
      sessionSpots.map((spot) => ({
        ...spot,
        commentCount: commentCounts[spot.id] ?? spot.commentCount,
      })),
    [commentCounts, sessionSpots]
  );

  const emptyState =
    isLoading && recentSpots.length === 0 ? (
      <View
        accessibilityLabel="Loading latest spots"
        className="flex-1 bg-surface-soft"
        style={{ height: pageHeight }}
      />
    ) : error && recentSpots.length === 0 ? (
      <View className="flex-1 px-4 pt-4" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-start rounded-2xl border border-errorBorder bg-errorSurface px-3 py-2.5">
          <Text className="flex-1 pr-2 font-outfit-medium text-sm text-errorText">
            {error}
          </Text>
          <FeedbackPressable
            onPress={retry}
            className="rounded-xl bg-accent px-3 py-1.5"
            accessibilityRole="button"
            accessibilityLabel="Retry loading latest spots"
          >
            <Text className="font-outfit-bold text-sm text-brand">Retry</Text>
          </FeedbackPressable>
        </View>
      </View>
    ) : hasMore && !error ? (
      <View
        accessibilityLabel="Loading latest spots"
        className="flex-1 items-center justify-center bg-surface-soft"
        style={{ height: pageHeight }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    ) : (
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ paddingTop: insets.top }}
      >
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent">
          <Feather name="map-pin" size={26} color={colors.brand} />
        </View>
        <Text className="mt-3 font-outfit-bold text-lg text-ink">
          No spots yet
        </Text>
        <Text className="mt-1 text-center font-outfit-medium text-base text-muted">
          When someone adds a spot, it’ll show up here.
        </Text>
      </View>
    );

  return (
    <View className="flex-1 bg-surface">
      {sessionSpots.length === 0 ? (
        emptyState
      ) : (
        <FlatList
          className="min-h-0 flex-1"
          data={sessionSpots}
          keyExtractor={(spot, index) => `${spot.id}:${index}`}
          extraData={{ commentCounts, pageHeight, length: sessionSpots.length }}
          renderItem={({ item }) => (
            <HomeSpotPost
              layout="immersive"
              pageHeight={pageHeight}
              topInset={insets.top}
              spot={{
                ...item,
                commentCount: commentCounts[item.id] ?? item.commentCount,
              }}
              onLike={handleLikeSpot}
              onViewMap={handleViewMap}
              onOpenComments={handleOpenComments}
              onOpenFullscreen={handleOpenFullscreen}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          showsVerticalScrollIndicator={false}
          pagingEnabled
          disableIntervalMomentum
          overScrollMode="never"
          snapToInterval={pageHeight}
          snapToAlignment="start"
          decelerationRate={FEED_DECELERATION_RATE}
          getItemLayout={(_data, index) => ({
            length: pageHeight,
            offset: pageHeight * index,
            index,
          })}
          onLayout={(event) => {
            const nextHeight = Math.round(event.nativeEvent.layout.height);
            if (nextHeight > 0 && nextHeight !== listHeight) {
              setListHeight(nextHeight);
            }
          }}
          onEndReached={handleNeedMore}
          onEndReachedThreshold={0.6}
          onMomentumScrollEnd={(event) => {
            if (pageHeight <= 0) {
              return;
            }

            noteVisibleIndex(
              Math.round(event.nativeEvent.contentOffset.y / pageHeight)
            );
          }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={5}
          removeClippedSubviews={false}
        />
      )}

      {sessionSpots.length > 0 && error ? (
        <View className="absolute bottom-4 left-4 right-4">
          <StaleCacheBanner
            message={STALE_SPOTS_MESSAGE}
            onRetry={retry}
            retryAccessibilityLabel="Retry loading latest spots"
          />
        </View>
      ) : null}


      <SpotFullscreenViewer
        visible={fullscreenSpotId !== null && !commentsCoveringViewer}
        spots={viewerSpots}
        initialSpotId={fullscreenSpotId ?? ''}
        initialPhotoIndex={fullscreenPhotoIndex}
        variant="feed"
        onClose={() => setFullscreenSpotId(null)}
        onLike={handleLikeSpot}
        onOpenComments={handleOpenComments}
        onViewMap={handleViewMapFromFullscreen}
        onNearEnd={handleNeedMore}
      />
      <LoginRequiredModal
        visible={showLoginRequired}
        onCancel={() => setShowLoginRequired(false)}
      />
    </View>
  );
}
