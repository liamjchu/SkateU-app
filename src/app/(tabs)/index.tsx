import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from '../../components/FeedbackPressable';
import HomeNotificationsButton from '../../components/home-notifications-button';
import HomeRailCard, { HomeFeedRail } from '../../components/home-rail-card';
import HomeSchoolStories from '../../components/home-school-stories';
import HomeSpotPost from '../../components/home-spot-post';
import LoginRequiredModal from '../../components/LoginRequiredModal';
import NearbySchoolsRail from '../../components/nearby-schools-rail';
import SpotFullscreenViewer from '../../components/spot-fullscreen-viewer';
import NoticeBanner from '../../components/NoticeBanner';
import {
    SchoolSpotCount,
} from '../../components/PopularSchoolCard';
import StaleCacheBanner from '../../components/StaleCacheBanner';
import { StickerStripe } from '../../components/sticker';
import IMAGES from '../../constants/images';
import { colors } from '../../constants/colors';
import { useHydrateFavoriteSchools } from '../../hooks/useHydrateFavoriteSchools';
import { useNearbySchools } from '../../hooks/useNearbySchools';
import { useFeedPrefetch } from '../../hooks/useFeedPrefetch';
import { useRecentSpotsFeed } from '../../hooks/useRecentSpotsFeed';
import { captureAnalyticsEvent } from '../../lib/analytics';
import { getApiUrl } from '../../lib/api';
import {
    FEED_END_REACHED_THRESHOLD,
    HOME_RAIL_PAGE_SIZE,
} from '../../lib/homeFeed';
import {
    getHomeLogoTapAction,
    getHomeLogoTapHint,
    isHomeFeedScrolled,
} from '../../lib/homeLogoTap';
import { openSchoolOnMap, openSpotOnMap } from '../../lib/mapNavigation';
import { toMutationError, toUserFacingError } from '../../lib/userFacingError';
import { guardedNavigate, useGuardedRouter } from '../../lib/navigationGuard';
import {
    STALE_SCHOOLS_MESSAGE,
    STALE_SPOTS_MESSAGE,
} from '../../lib/readCache';
import {
    formatGuestBrowseMessage,
    GUEST_BROWSE_TITLE,
} from '../../lib/guestBrowseCopy';
import { useAuthStore } from '../../store/authStore';
import { useCommentsStore } from '../../store/commentsStore';
import { useFavorites } from '../../store/favoritesStore';
import { useSchools } from '../../store/schoolsStore';
import { useSpotsStore } from '../../store/spotsStore';
import type { School } from '../../types/school';
import type { Spot } from '../../types/spot';

type SchoolsSearchResponse = {
  schools: School[];
};

const HEADER_LOGO_HEIGHT = (44 * 2) / 3;
const HEADER_LOGO_WIDTH = (195 / 36) * HEADER_LOGO_HEIGHT;
const POPULAR_FILTER = 'all' as const;

export default function HomeScreen() {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const { upsertSchool, popularSchools: cachedPopularSchools, popularFilter, setPopularFeed } = useSchools();
  const session = useAuthStore((state) => state.session);
  const authInitializing = useAuthStore((state) => state.initializing);
  const toggleSpotLike = useSpotsStore((state) => state.toggleSpotLike);
  const commentCounts = useCommentsStore((state) => state.commentCounts);
  const {
    recentSpots,
    isLoading: isLoadingRecent,
    isLoadingMore: isLoadingMoreRecent,
    error: recentError,
    loadMore: loadMoreRecentSpots,
    retry: retryRecentSpots,
  } = useRecentSpotsFeed();
  const { onViewableItemsChanged, viewabilityConfig } = useFeedPrefetch(
    recentSpots.length,
    loadMoreRecentSpots
  );
  const {
    favoriteSchoolIds,
    hasHydrated: hasHydratedFavorites,
    toggleFavoriteSchool,
    upsertFavoriteSchool,
  } = useFavorites();
  const { favoriteSchools } = useHydrateFavoriteSchools();

  const feedListRef = useRef<FlatList<Spot>>(null);
  const feedScrollOffsetRef = useRef(0);
  const [isFeedScrolled, setIsFeedScrolled] = useState(false);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [popularError, setPopularError] = useState('');
  const [popularRetryNonce, setPopularRetryNonce] = useState(0);
  const [isLoadingMorePopular, setIsLoadingMorePopular] = useState(false);
  const [popularHasMore, setPopularHasMore] = useState(true);
  const [favoriteRefreshNonce, setFavoriteRefreshNonce] = useState(0);
  const [showLoginRequired, setShowLoginRequired] = useState(false);
  const [fullscreenSpotId, setFullscreenSpotId] = useState<string | null>(
    null
  );
  const [fullscreenPhotoIndex, setFullscreenPhotoIndex] = useState(0);
  const [commentsCoveringViewer, setCommentsCoveringViewer] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const popularAbortRef = useRef<AbortController | null>(null);
  const popularLockRef = useRef(false);
  const popularHasMoreRef = useRef(true);
  const isLoadingPopularRef = useRef(true);
  const popularSchoolsRef = useRef<School[]>([]);

  popularHasMoreRef.current = popularHasMore;
  isLoadingPopularRef.current = isLoadingPopular || isLoadingMorePopular;
  const popularSchools =
    popularFilter === POPULAR_FILTER ? cachedPopularSchools : [];
  popularSchoolsRef.current = popularSchools;

  const {
    schools: nearbySchools,
    origin: nearbyOrigin,
    status: nearbyStatus,
    error: nearbyError,
    enableLocation: enableNearbyLocation,
    retry: retryNearbySchools,
  } = useNearbySchools(POPULAR_FILTER);

  useFocusEffect(
    useCallback(() => {
      if (!hasHydratedFavorites || favoriteSchoolIds.length === 0) {
        return;
      }

      let cancelled = false;
      const controller = new AbortController();

      const refreshFavoriteSchools = async () => {
        try {
          const response = await fetch(
            getApiUrl(`/api/schools?ids=${encodeURIComponent(favoriteSchoolIds.join(','))}`),
            { signal: controller.signal }
          );

          if (!response.ok) {
            throw new Error('Couldn’t refresh saved schools right now.');
          }

          const data = (await response.json()) as SchoolsSearchResponse;
          if (cancelled) {
            return;
          }
          data.schools.forEach((school) => {
            upsertSchool(school);
            upsertFavoriteSchool(school);
          });
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
        }
      };

      void refreshFavoriteSchools();

      return () => {
        cancelled = true;
        controller.abort();
      };
    }, [
      favoriteRefreshNonce,
      favoriteSchoolIds,
      hasHydratedFavorites,
      upsertFavoriteSchool,
      upsertSchool,
    ])
  );

  useFocusEffect(
    useCallback(() => {
      setCommentsCoveringViewer(false);
    }, [])
  );

  useEffect(() => {
    popularAbortRef.current?.abort();

    const controller = new AbortController();
    popularAbortRef.current = controller;
    popularLockRef.current = false;
    setPopularHasMore(true);
    setIsLoadingPopular(true);
    setIsLoadingMorePopular(false);

    const loadPopularSchools = async () => {
      try {
        const response = await fetch(
          getApiUrl('/api/schools?popular=1'),
          { signal: controller.signal }
        );

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            errorData?.error ?? `Popular schools failed with status ${response.status}`
          );
        }

        const data = (await response.json()) as SchoolsSearchResponse;
        const page = data.schools ?? [];
        page.forEach(upsertSchool);

        if (!controller.signal.aborted) {
          setPopularFeed(POPULAR_FILTER, page);
          setPopularHasMore(page.length === HOME_RAIL_PAGE_SIZE);
          setPopularError('');
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        if (!controller.signal.aborted) {
          setPopularError(
            toUserFacingError(error, 'Couldn’t load popular schools right now.')
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPopular(false);
        }
      }
    };

    void loadPopularSchools();

    return () => controller.abort();
  }, [popularRetryNonce, setPopularFeed, upsertSchool]);

  const loadMorePopularSchools = useCallback(async () => {
    if (
      popularLockRef.current ||
      isLoadingPopularRef.current ||
      !popularHasMoreRef.current
    ) {
      return;
    }

    const controller = popularAbortRef.current;
    if (!controller || controller.signal.aborted) {
      return;
    }

    popularLockRef.current = true;
    setIsLoadingMorePopular(true);

    try {
      const offset = popularSchoolsRef.current.length;
      const response = await fetch(
        getApiUrl(`/api/schools?popular=1&offset=${offset}`),
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error('Couldn’t load more popular schools right now.');
      }

      const data = (await response.json()) as SchoolsSearchResponse;
      const page = data.schools ?? [];
      page.forEach(upsertSchool);

      if (!controller.signal.aborted) {
        const current = popularSchoolsRef.current;
        const seen = new Set(current.map((school) => school.id));
        setPopularFeed(POPULAR_FILTER, [
          ...current,
          ...page.filter((school) => !seen.has(school.id)),
        ]);
        setPopularHasMore(page.length === HOME_RAIL_PAGE_SIZE);
        setPopularError('');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      if (!controller.signal.aborted) {
        setPopularError(
          toUserFacingError(
            error,
            'Couldn’t load more popular schools right now.'
          )
        );
      }
    } finally {
      popularLockRef.current = false;
      if (!controller.signal.aborted) {
        setIsLoadingMorePopular(false);
      }
    }
  }, [setPopularFeed, upsertSchool]);

  const handleSchoolPress = useCallback((school: School) => {
    upsertSchool(school);
    openSchoolOnMap(router, school);
  }, [router, upsertSchool]);

  const handleRecentSpotPress = (spot: Spot) => {
    if (!openSpotOnMap(router, spot)) {
      Alert.alert(
        'Campus map unavailable',
        'This spot is not tied to a campus, so there is no map to open.'
      );
    }
  };

  const handleLikeSpot = async (spot: Spot) => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setShowLoginRequired(true);
      return;
    }

    try {
      await toggleSpotLike(
        spot.id,
        spot.likedByUser === true,
        accessToken
      );
    } catch (error) {
      Alert.alert(
        'Couldn’t update that like',
        toMutationError(error, 'Please try again.')
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

  const handleViewMapFromFullscreen = (spot: Spot) => {
    setFullscreenSpotId(null);
    handleRecentSpotPress(spot);
  };

  const feedViewerSpots = useMemo(
    () =>
      recentSpots.map((spot) => ({
        ...spot,
        commentCount: commentCounts[spot.id] ?? spot.commentCount,
      })),
    [commentCounts, recentSpots]
  );

  const handleFavoritePress = useCallback((school: School) => {
    upsertSchool(school);
    toggleFavoriteSchool(school);
  }, [toggleFavoriteSchool, upsertSchool]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setIsLoadingPopular(true);
    setPopularRetryNonce((nonce) => nonce + 1);
    setFavoriteRefreshNonce((nonce) => nonce + 1);
    retryRecentSpots();
    retryNearbySchools();
  };

  const homeLogoTapAction = getHomeLogoTapAction({
    isScrolled: isFeedScrolled,
  });

  const handleHomeLogoPress = () => {
    const action = getHomeLogoTapAction({
      isScrolled: isHomeFeedScrolled(feedScrollOffsetRef.current),
    });

    if (action === 'scroll-to-top') {
      feedListRef.current?.scrollToOffset({ offset: 0, animated: true });
      feedScrollOffsetRef.current = 0;
      setIsFeedScrolled(false);
      return;
    }

    if (isRefreshing) {
      return;
    }

    handleRefresh();
  };

  useEffect(() => {
    if (!isRefreshing) {
      return;
    }

    if (!isLoadingPopular && !isLoadingRecent) {
      setIsRefreshing(false);
    }
  }, [isLoadingPopular, isLoadingRecent, isRefreshing]);

  const feedRefreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      tintColor={colors.accent}
      colors={[colors.accent]}
    />
  );

  const trackFeedScroll = (offsetY: number) => {
    feedScrollOffsetRef.current = offsetY;
    const scrolled = isHomeFeedScrolled(offsetY);
    if (scrolled !== isFeedScrolled) {
      setIsFeedScrolled(scrolled);
    }
  };

  const homeFeedListHeader = useMemo(
    () => (
      <View className="gap-8">
        <HomeSchoolStories
          schools={favoriteSchools}
          onPress={handleSchoolPress}
          onToggleSave={handleFavoritePress}
        />

        <NearbySchoolsRail
          schools={nearbySchools}
          origin={nearbyOrigin}
          status={nearbyStatus}
          error={nearbyError}
          savedSchoolIds={favoriteSchoolIds}
          onEnableLocation={() => {
            void enableNearbyLocation();
          }}
          onRetry={retryNearbySchools}
          onPress={handleSchoolPress}
          onToggleSave={handleFavoritePress}
        />

        <HomeFeedRail
          title="Popular schools"
          subtitle="Tap a campus to open its map"
          isLoading={isLoadingPopular && popularSchools.length === 0}
          loadingAccessibilityLabel="Loading popular schools"
          error={
            popularError && popularSchools.length > 0
              ? STALE_SCHOOLS_MESSAGE
              : popularError
          }
          onRetry={() => {
            setPopularError('');
            setPopularRetryNonce((nonce) => nonce + 1);
          }}
          retryAccessibilityLabel="Retry loading popular schools"
          isEmpty={popularSchools.length === 0}
          onEndReached={loadMorePopularSchools}
          isLoadingMore={isLoadingMorePopular}
          empty={
            <View className="items-center rounded-2xl bg-field px-6 py-8">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent">
                <Feather name="trending-up" size={26} color={colors.brand} />
              </View>
              <Text className="mt-3 text-lg text-ink font-outfit-bold">
                No popular schools yet
              </Text>
              <Text className="mt-1 text-center text-base leading-5 text-muted font-outfit-medium">
                Schools with the most skate spots will show up here.
              </Text>
            </View>
          }
        >
          {popularSchools.map((school: School) => {
            const isSaved = favoriteSchoolIds.includes(school.id);

            return (
              <HomeRailCard
                key={school.id}
                imageUrl={school.spotImageUrl}
                title={school.name}
                subtitle={`${school.city}, ${school.state}`}
                meta={
                  <SchoolSpotCount
                    count={school.numSpots}
                    type={school.type}
                  />
                }
                onPress={() => handleSchoolPress(school)}
                accessibilityLabel={`Open ${school.name} campus map`}
                accessory={
                  <FeedbackPressable
                    haptic="selection"
                    onPress={() => handleFavoritePress(school)}
                    className={`h-9 w-9 items-center justify-center rounded-full ${
                      isSaved ? 'bg-accent' : 'bg-white'
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel={`${isSaved ? 'Remove' : 'Add'} ${school.name} ${isSaved ? 'from' : 'to'} saved schools`}
                    accessibilityState={{ selected: isSaved }}
                  >
                    <Ionicons
                      name={isSaved ? 'bookmark' : 'bookmark-outline'}
                      size={16}
                      color={isSaved ? colors.brand : colors.ink}
                    />
                  </FeedbackPressable>
                }
              />
            );
          })}
        </HomeFeedRail>

        <View>
          <View className="mb-4">
            <Text className="font-outfit-bold text-base text-ink">
              Latest spots
            </Text>
            <Text className="mt-0.5 font-outfit-medium text-sm text-muted">
              Newest from every campus
            </Text>
          </View>

          {isLoadingRecent && recentSpots.length === 0 ? (
            <View
              accessibilityLabel="Loading latest spots"
              className="gap-4"
            >
              {[0, 1].map((placeholder) => (
                <View
                  key={placeholder}
                  className="h-80 rounded-2xl bg-field"
                />
              ))}
            </View>
          ) : recentError && recentSpots.length === 0 ? (
            <View className="flex-row items-center rounded-2xl border border-errorBorder bg-errorSurface px-3 py-2.5">
              <Text className="flex-1 pr-2 font-outfit-medium text-sm text-errorText">
                {recentError}
              </Text>
              <FeedbackPressable
                onPress={retryRecentSpots}
                className="rounded-xl bg-accent px-3 py-1.5"
                accessibilityRole="button"
                accessibilityLabel="Retry loading latest spots"
              >
                <Text className="font-outfit-bold text-sm text-brand">
                  Retry
                </Text>
              </FeedbackPressable>
            </View>
          ) : recentSpots.length === 0 ? (
            <View className="items-center rounded-2xl bg-field px-6 py-8">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent">
                <Feather name="map-pin" size={26} color={colors.brand} />
              </View>
              <Text className="mt-3 text-lg text-ink font-outfit-bold">
                No spots yet
              </Text>
              <Text className="mt-1 text-center text-base leading-5 text-muted font-outfit-medium">
                When someone adds a spot, it’ll show up here to like or
                open on the map.
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    ),
    [
      enableNearbyLocation,
      favoriteSchoolIds,
      favoriteSchools,
      handleFavoritePress,
      handleSchoolPress,
      isLoadingPopular,
      isLoadingRecent,
      loadMorePopularSchools,
      nearbyError,
      nearbyOrigin,
      nearbySchools,
      nearbyStatus,
      popularError,
      popularSchools,
      recentError,
      recentSpots.length,
      retryNearbySchools,
      isLoadingMorePopular,
      retryRecentSpots,
    ]
  );

  return (
    <View className="flex-1 bg-surface">
      <View className="bg-brand">
        <View
          className="px-6 pb-5"
          style={{
            paddingTop: insets.top + 24,
          }}
        >
          <View className="h-11 flex-row items-center justify-between">
            <FeedbackPressable
              haptic="light"
              disablePressScale
              onPress={handleHomeLogoPress}
              className="h-11 justify-center"
              accessibilityRole="button"
              accessibilityLabel="SkateU"
              accessibilityHint={getHomeLogoTapHint(homeLogoTapAction)}
            >
              <Image
                source={IMAGES.brandLockup}
                style={{
                  width: HEADER_LOGO_WIDTH,
                  height: HEADER_LOGO_HEIGHT,
                }}
                resizeMode="contain"
                accessible={false}
              />
            </FeedbackPressable>
            <HomeNotificationsButton
              accessToken={session?.access_token ?? null}
            />
          </View>
        </View>
        <StickerStripe />
      </View>

      <View className="w-full max-w-[760px] flex-1 self-center px-6">
        {!session && !authInitializing ? (
          <View className="pt-6">
            <NoticeBanner
              id="guest-browse-v2"
              icon="eye-outline"
              title={GUEST_BROWSE_TITLE}
              message={formatGuestBrowseMessage()}
              actionLabel="Sign up"
              onAction={() =>
                guardedNavigate('signup', () => {
                  router.push('/signup');
                })
              }
            />
          </View>
        ) : null}

        <FlatList
          ref={feedListRef}
          className="min-h-0 flex-1"
          data={recentSpots}
          keyExtractor={(spot) => spot.id}
          extraData={{
            commentCounts,
            isLoadingMoreRecent,
            recentError,
          }}
          renderItem={({ item }) => (
            <HomeSpotPost
              spot={{
                ...item,
                commentCount:
                  commentCounts[item.id] ?? item.commentCount,
              }}
              onLike={handleLikeSpot}
              onViewMap={handleRecentSpotPress}
              onOpenComments={handleOpenComments}
              onOpenFullscreen={handleOpenFullscreen}
            />
          )}
          ListHeaderComponent={homeFeedListHeader}
          ListFooterComponent={
            recentSpots.length === 0 ? null : recentError ? (
              <StaleCacheBanner
                message={STALE_SPOTS_MESSAGE}
                onRetry={retryRecentSpots}
                retryAccessibilityLabel="Retry loading latest spots"
              />
            ) : isLoadingMoreRecent ? (
              <View className="items-center py-6">
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : (
              <View className="h-8" />
            )
          }
          ItemSeparatorComponent={() => <View className="h-4" />}
          contentContainerStyle={{ paddingBottom: 32, paddingTop: 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={feedRefreshControl}
          scrollEventThrottle={16}
          onScroll={(event) => {
            trackFeedScroll(event.nativeEvent.contentOffset.y);
          }}
          onEndReached={loadMoreRecentSpots}
          onEndReachedThreshold={FEED_END_REACHED_THRESHOLD}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews
        />
      </View>

      <SpotFullscreenViewer
        visible={fullscreenSpotId !== null && !commentsCoveringViewer}
        spots={feedViewerSpots}
        initialSpotId={fullscreenSpotId ?? ''}
        initialPhotoIndex={fullscreenPhotoIndex}
        variant="feed"
        onClose={() => setFullscreenSpotId(null)}
        onLike={handleLikeSpot}
        onOpenComments={handleOpenComments}
        onViewMap={handleViewMapFromFullscreen}
        onNearEnd={loadMoreRecentSpots}
      />
      <LoginRequiredModal
        visible={showLoginRequired}
        onCancel={() => setShowLoginRequired(false)}
      />
    </View>
  );
}
