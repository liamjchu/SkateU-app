import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Text,
    View,
} from 'react-native';
import FeedbackPressable from '../../components/FeedbackPressable';
import ProfileIdentityCard from '../../components/profile-identity-card';
import ProfileSpotRow from '../../components/profile-spot-row';
import ScreenHeader from '../../components/screen-header';
import SocialLinks from '../../components/social-links';
import { colors } from '../../constants/colors';
import { captureAnalyticsEvent } from '../../lib/analytics';
import { PROFILE_SPOTS_PAGE_SIZE } from '../../lib/homeFeed';
import { openSpotOnMap } from '../../lib/mapNavigation';
import { guardedNavigate, useGuardedRouter } from '../../lib/navigationGuard';
import {
    fetchCreatorSpots,
    fetchPublicProfileView,
    followUser,
    unfollowUser,
} from '../../lib/publicProfile';
import { toMutationError, toUserFacingError } from '../../lib/userFacingError';
import { useAuthStore } from '../../store/authStore';
import type { PublicProfileView } from '../../types/publicProfile';
import type { Spot } from '../../types/spot';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}

export default function UserProfileScreen() {
  const router = useGuardedRouter();
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userId = firstParam(params.userId);
  const session = useAuthStore((state) => state.session);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  const [profile, setProfile] = useState<PublicProfileView | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [spotTotal, setSpotTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spotsError, setSpotsError] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const loadingMoreLock = useRef(false);

  const hasMoreSpots = spots.length < spotTotal;

  const load = useCallback(async () => {
    if (!userId) {
      setError('This profile isn’t available.');
      setLoading(false);
      return;
    }

    if (currentUserId && userId === currentUserId) {
      router.replace('/profile');
      return;
    }

    setLoading(true);
    setError(null);
    setSpotsError(null);
    loadingMoreLock.current = false;

    const accessToken = session?.access_token ?? null;

    try {
      const [nextProfile, nextSpots] = await Promise.all([
        fetchPublicProfileView(userId, accessToken),
        fetchCreatorSpots(userId, accessToken, 0).catch((spotError: unknown) => {
          setSpotsError(
            toUserFacingError(spotError, 'Couldn’t load those spots right now.')
          );
          return { spots: [] as Spot[], total: 0 };
        }),
      ]);
      setProfile(nextProfile);
      setSpots(nextSpots.spots);
      setSpotTotal(nextSpots.total);
    } catch (loadError) {
      setProfile(null);
      setSpots([]);
      setSpotTotal(0);
      setError(
        toUserFacingError(loadError, 'Couldn’t load that profile right now.')
      );
    } finally {
      setLoading(false);
    }
  }, [currentUserId, router, session?.access_token, userId]);

  const loadMoreSpots = useCallback(async () => {
    if (
      !userId ||
      loading ||
      loadingMoreLock.current ||
      spots.length === 0 ||
      spots.length >= spotTotal
    ) {
      return;
    }

    loadingMoreLock.current = true;
    setLoadingMore(true);
    setSpotsError(null);

    try {
      const nextPage = await fetchCreatorSpots(
        userId,
        session?.access_token ?? null,
        spots.length
      );
      setSpots((current) => {
        const seen = new Set(current.map((spot) => spot.id));
        return [
          ...current,
          ...nextPage.spots.filter((spot) => !seen.has(spot.id)),
        ];
      });
      setSpotTotal(nextPage.total);
    } catch (spotError) {
      setSpotsError(
        toUserFacingError(spotError, 'Couldn’t load those spots right now.')
      );
    } finally {
      loadingMoreLock.current = false;
      setLoadingMore(false);
    }
  }, [loading, session?.access_token, spots.length, spotTotal, userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleSpotPress = (spot: Spot) => {
    if (!openSpotOnMap(router, spot)) {
      Alert.alert(
        'Campus map unavailable',
        'This spot is not tied to a campus, so there is no map to open.'
      );
    }
  };

  const handleFollowPress = async () => {
    if (!userId || !profile || followBusy) {
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      guardedNavigate('login-to-follow', () => {
        router.push('/signup');
      });
      return;
    }

    setFollowBusy(true);
    try {
      const next = profile.isFollowing
        ? await unfollowUser(userId, accessToken, profile)
        : await followUser(userId, accessToken, profile);
      setProfile(next);
      captureAnalyticsEvent(
        next.isFollowing ? 'user_followed' : 'user_unfollowed',
        { followed_user_id: userId }
      );
    } catch (followError) {
      Alert.alert(
        profile.isFollowing ? 'Couldn’t unfollow' : 'Couldn’t follow',
        toMutationError(followError, 'Try again in a sec.')
      );
    } finally {
      setFollowBusy(false);
    }
  };

  const displayName = profile?.username
    ? `@${profile.username}`
    : 'A skater';

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        title="Profile"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }

          router.replace('/');
        }}
      />

      <FlatList
        className="flex-1"
        data={profile ? spots : []}
        keyExtractor={(spot) => spot.id}
        renderItem={({ item }) => (
          <ProfileSpotRow
            spot={item}
            onPress={() => handleSpotPress(item)}
          />
        )}
        ListHeaderComponent={
          loading && !profile ? (
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Loading profile"
              className="items-center rounded-2xl bg-field px-4 py-10"
            >
              <ActivityIndicator size="small" color={colors.ink} />
              <Text className="mt-2 font-outfit-medium text-sm text-muted">
                Loading profile…
              </Text>
            </View>
          ) : error ? (
            <View className="items-center rounded-2xl border border-errorBorder bg-errorSurface p-5">
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                className="text-center font-outfit-medium text-sm text-errorText"
              >
                {error}
              </Text>
              <FeedbackPressable
                onPress={() => {
                  void load();
                }}
                className="mt-3 rounded-xl bg-accent px-4 py-2"
                accessibilityRole="button"
                accessibilityLabel="Retry loading profile"
              >
                <Text className="font-outfit-bold text-xs text-brand">Retry</Text>
              </FeedbackPressable>
            </View>
          ) : profile ? (
            <View className="mb-3">
              <ProfileIdentityCard
                uri={profile.avatarUrl}
                rank={profile.rank}
                displayName={displayName}
                spotCount={spotTotal}
                followerCount={profile.followerCount}
                followingCount={profile.followingCount}
                bio={profile.bio}
                onFollowersPress={() => {
                  router.push({
                    pathname: '/follow-list',
                    params: {
                      userId: profile.id,
                      tab: 'followers',
                      ...(profile.username ? { username: profile.username } : {}),
                    },
                  });
                }}
                onFollowingPress={() => {
                  router.push({
                    pathname: '/follow-list',
                    params: {
                      userId: profile.id,
                      tab: 'following',
                      ...(profile.username ? { username: profile.username } : {}),
                    },
                  });
                }}
              >
                <FeedbackPressable
                  haptic="light"
                  onPress={() => {
                    void handleFollowPress();
                  }}
                  disabled={followBusy}
                  className={`mt-4 h-12 w-full items-center justify-center rounded-2xl ${
                    profile.isFollowing ? 'bg-surface-soft' : 'bg-brand'
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={
                    profile.isFollowing ? 'Unfollow' : 'Follow'
                  }
                  accessibilityState={{ busy: followBusy, disabled: followBusy }}
                >
                  {followBusy ? (
                    <ActivityIndicator
                      size="small"
                      color={profile.isFollowing ? colors.ink : colors.white}
                    />
                  ) : (
                    <Text
                      className={`font-outfit-bold text-sm ${
                        profile.isFollowing ? 'text-ink' : 'text-white'
                      }`}
                    >
                      {profile.isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  )}
                </FeedbackPressable>
              </ProfileIdentityCard>
              {spotsError && spots.length === 0 ? (
                <View className="mt-4 items-center rounded-2xl border border-errorBorder bg-errorSurface p-5">
                  <Text
                    accessibilityRole="alert"
                    className="text-center font-outfit-medium text-sm text-errorText"
                  >
                    {spotsError}
                  </Text>
                  <FeedbackPressable
                    onPress={() => {
                      void load();
                    }}
                    className="mt-3 rounded-xl bg-accent px-4 py-2"
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading spots"
                  >
                    <Text className="font-outfit-bold text-xs text-brand">
                      Retry
                    </Text>
                  </FeedbackPressable>
                </View>
              ) : spots.length === 0 && !loading ? (
                <View className="mt-4 rounded-2xl bg-field p-6">
                  <Text className="font-outfit-medium text-center text-sm text-muted">
                    No spots yet.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null
        }
        ListFooterComponent={
          <>
            {loadingMore ? (
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel="Loading more spots"
                className="items-center py-4"
              >
                <ActivityIndicator size="small" color={colors.ink} />
              </View>
            ) : spotsError && spots.length > 0 ? (
              <View className="mb-4 items-center rounded-2xl border border-errorBorder bg-errorSurface p-5">
                <Text
                  accessibilityRole="alert"
                  className="text-center font-outfit-medium text-sm text-errorText"
                >
                  {spotsError}
                </Text>
                <FeedbackPressable
                  onPress={() => {
                    void loadMoreSpots();
                  }}
                  className="mt-3 rounded-xl bg-accent px-4 py-2"
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading more spots"
                >
                  <Text className="font-outfit-bold text-xs text-brand">
                    Retry
                  </Text>
                </FeedbackPressable>
              </View>
            ) : null}
            <View className="mt-8 items-center">
              <SocialLinks showCaption />
            </View>
          </>
        }
        contentContainerClassName="self-center w-full max-w-[720px] px-6 pb-10 pt-6"
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (hasMoreSpots) {
            void loadMoreSpots();
          }
        }}
        onEndReachedThreshold={0.6}
        initialNumToRender={PROFILE_SPOTS_PAGE_SIZE}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
      />
    </View>
  );
}
