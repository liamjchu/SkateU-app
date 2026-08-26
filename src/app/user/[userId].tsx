import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    View,
} from 'react-native';
import FeedbackPressable from '../../components/FeedbackPressable';
import ProfileAvatar from '../../components/ProfileAvatar';
import ProfileBioText from '../../components/ProfileBioText';
import ProfileFollowStats from '../../components/profile-follow-stats';
import ProfileSpotRow from '../../components/profile-spot-row';
import ScreenHeader from '../../components/screen-header';
import SocialLinks from '../../components/social-links';
import { colors } from '../../constants/colors';
import { captureAnalyticsEvent } from '../../lib/analytics';
import { guardedNavigate } from '../../lib/navigationGuard';
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
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userId = firstParam(params.userId);
  const session = useAuthStore((state) => state.session);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  const [profile, setProfile] = useState<PublicProfileView | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spotsError, setSpotsError] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

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

    const accessToken = session?.access_token ?? null;

    try {
      const [nextProfile, nextSpots] = await Promise.all([
        fetchPublicProfileView(userId, accessToken),
        fetchCreatorSpots(userId, accessToken).catch((spotError: unknown) => {
          setSpotsError(
            toUserFacingError(spotError, 'Couldn’t load those spots right now.')
          );
          return [] as Spot[];
        }),
      ]);
      setProfile(nextProfile);
      setSpots(nextSpots);
    } catch (loadError) {
      setProfile(null);
      setSpots([]);
      setError(
        toUserFacingError(loadError, 'Couldn’t load that profile right now.')
      );
    } finally {
      setLoading(false);
    }
  }, [currentUserId, router, session?.access_token, userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleSpotPress = (spot: Spot) => {
    if (!spot.schoolId) {
      Alert.alert(
        'Campus map unavailable',
        'This spot is not tied to a campus, so there is no map to open.'
      );
      return;
    }

    guardedNavigate(`map-spot:${spot.id}`, () => {
      router.push({
        pathname: '/map',
        params: {
          lat: spot.latitude.toString(),
          lng: spot.longitude.toString(),
          schoolId: spot.schoolId,
          schoolName: spot.schoolName || 'Campus map',
          schoolCity: spot.city,
          schoolState: spot.state,
          spotId: spot.id,
        },
      });
    });
  };

  const handleFollowPress = async () => {
    if (!userId || !profile || followBusy) {
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      guardedNavigate('login-to-follow', () => {
        router.push('/login');
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

      <ScrollView
        className="flex-1"
        contentContainerClassName="self-center w-full max-w-[720px] px-6 pb-10 pt-6"
        showsVerticalScrollIndicator={false}
      >
        {loading && !profile ? (
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
          <>
            <View className="items-center rounded-2xl bg-field p-6">
              <View className="mb-4">
                <ProfileAvatar uri={profile.avatarUrl} size={96} iconSize={40} />
              </View>
              <Text
                className="max-w-full px-4 text-center font-outfit-black text-2xl text-ink"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {displayName}
              </Text>
              {profile.bio ? (
                <View className="mt-3 w-full px-2">
                  <ProfileBioText bio={profile.bio} />
                </View>
              ) : null}
              <ProfileFollowStats
                followerCount={profile.followerCount}
                followingCount={profile.followingCount}
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
              />
              <FeedbackPressable
                haptic="light"
                onPress={() => {
                  void handleFollowPress();
                }}
                disabled={followBusy}
                className={`mt-5 h-12 w-full max-w-[240px] items-center justify-center rounded-2xl ${
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
            </View>

            <Text className="mt-8 font-outfit-bold text-sm text-muted">Spots</Text>
            {spotsError ? (
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
            ) : spots.length === 0 ? (
              <View className="mt-4 rounded-2xl bg-field p-6">
                <Text className="font-outfit-medium text-center text-sm text-muted">
                  No spots yet.
                </Text>
              </View>
            ) : (
              <View className="mt-3">
                {spots.map((spot) => (
                  <ProfileSpotRow
                    key={spot.id}
                    spot={spot}
                    onPress={() => handleSpotPress(spot)}
                  />
                ))}
              </View>
            )}
          </>
        ) : null}

        <View className="mt-8 items-center">
          <SocialLinks showCaption />
        </View>
      </ScrollView>
    </View>
  );
}
