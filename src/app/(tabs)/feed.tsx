import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from '../../components/FeedbackPressable';
import HomeSpotPost from '../../components/home-spot-post';
import LoginRequiredModal from '../../components/LoginRequiredModal';
import SpotFullscreenViewer from '../../components/spot-fullscreen-viewer';
import StaleCacheBanner from '../../components/StaleCacheBanner';
import { colors } from '../../constants/colors';
import { useRecentSpotsFeed } from '../../hooks/useRecentSpotsFeed';
import { captureAnalyticsEvent } from '../../lib/analytics';
import { openSpotOnMap } from '../../lib/mapNavigation';
import { STALE_SPOTS_MESSAGE } from '../../lib/readCache';
import { toMutationError } from '../../lib/userFacingError';
import { guardedNavigate, useGuardedRouter } from '../../lib/navigationGuard';
import { useAuthStore } from '../../store/authStore';
import { useCommentsStore } from '../../store/commentsStore';
import { useSpotsStore } from '../../store/spotsStore';
import type { Spot } from '../../types/spot';

export default function FeedScreen() {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((state) => state.session);
  const toggleSpotLike = useSpotsStore((state) => state.toggleSpotLike);
  const commentCounts = useCommentsStore((state) => state.commentCounts);
  const {
    recentSpots,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    retry,
  } = useRecentSpotsFeed();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showLoginRequired, setShowLoginRequired] = useState(false);
  const [fullscreenSpotId, setFullscreenSpotId] = useState<string | null>(null);
  const [fullscreenPhotoIndex, setFullscreenPhotoIndex] = useState(0);
  const [commentsCoveringViewer, setCommentsCoveringViewer] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setCommentsCoveringViewer(false);
    }, [])
  );

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
      recentSpots.map((spot) => ({
        ...spot,
        commentCount: commentCounts[spot.id] ?? spot.commentCount,
      })),
    [commentCounts, recentSpots]
  );

  return (
    <View className="flex-1 bg-surface">
      <FlatList
        className="min-h-0 flex-1"
        data={recentSpots}
        keyExtractor={(spot) => spot.id}
        extraData={{ commentCounts, isLoadingMore, error }}
        renderItem={({ item }) => (
          <HomeSpotPost
            layout="immersive"
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
        ListHeaderComponent={
          isLoading && recentSpots.length === 0 ? (
            <View accessibilityLabel="Loading latest spots" className="gap-0">
              {[0, 1].map((placeholder) => (
                <View
                  key={placeholder}
                  className="border-b border-borderSoft bg-surface-soft"
                  style={{ height: 420 }}
                />
              ))}
            </View>
          ) : error && recentSpots.length === 0 ? (
            <View className="px-4 pt-4">
              <View className="flex-row items-center rounded-2xl border border-errorBorder bg-errorSurface px-3 py-2.5">
                <Text className="flex-1 pr-2 font-outfit-medium text-sm text-errorText">
                  {error}
                </Text>
                <FeedbackPressable
                  onPress={retry}
                  className="rounded-xl bg-accent px-3 py-1.5"
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading latest spots"
                >
                  <Text className="font-outfit-bold text-sm text-brand">
                    Retry
                  </Text>
                </FeedbackPressable>
              </View>
            </View>
          ) : recentSpots.length === 0 ? (
            <View className="items-center px-6 py-16">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent">
                <Feather name="map-pin" size={26} color={colors.brand} />
              </View>
              <Text className="mt-3 font-outfit-bold text-lg text-ink">
                No spots yet
              </Text>
              <Text className="mt-1 text-center font-outfit-medium text-base leading-5 text-muted">
                When someone adds a spot, it’ll show up here.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          recentSpots.length === 0 ? null : error ? (
            <View className="px-4 py-4">
              <StaleCacheBanner
                message={STALE_SPOTS_MESSAGE}
                onRetry={retry}
                retryAccessibilityLabel="Retry loading latest spots"
              />
            </View>
          ) : isLoadingMore ? (
            <View className="items-center py-6">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <View className="h-8" />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews
      />

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
        onNearEnd={loadMore}
      />
      <LoginRequiredModal
        visible={showLoginRequired}
        onCancel={() => setShowLoginRequired(false)}
      />
    </View>
  );
}
