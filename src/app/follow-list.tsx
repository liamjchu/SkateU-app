import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import FeedbackPressable from '../components/FeedbackPressable';
import ProfileFollowRow from '../components/profile-follow-row';
import ScreenHeader from '../components/screen-header';
import { colors } from '../constants/colors';
import { captureAnalyticsEvent } from '../lib/analytics';
import { guardedNavigate, useGuardedRouter } from '../lib/navigationGuard';
import {
  fetchFollowList,
  followListUserAsProfile,
  followUser,
  unfollowUser,
} from '../lib/publicProfile';
import { toMutationError, toUserFacingError } from '../lib/userFacingError';
import type { FollowListKind } from '../lib/userFollows';
import { useAuthStore } from '../store/authStore';
import type { FollowListUser } from '../types/publicProfile';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}

function tabFromParam(value: string | string[] | undefined): FollowListKind {
  return firstParam(value) === 'following' ? 'following' : 'followers';
}

export default function FollowListScreen() {
  const router = useGuardedRouter();
  const params = useLocalSearchParams<{
    userId?: string | string[];
    tab?: string | string[];
    username?: string | string[];
  }>();
  const userId = firstParam(params.userId);
  const headerUsername = firstParam(params.username);
  const session = useAuthStore((state) => state.session);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const accessToken = session?.access_token ?? null;

  const [tab, setTab] = useState<FollowListKind>(() => tabFromParam(params.tab));
  const [lists, setLists] = useState<Partial<Record<FollowListKind, FollowListUser[]>>>(
    {}
  );
  const [loading, setLoading] = useState<Partial<Record<FollowListKind, boolean>>>(
    {}
  );
  const [errors, setErrors] = useState<Partial<Record<FollowListKind, string | null>>>(
    {}
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadTab = useCallback(
    async (nextTab: FollowListKind) => {
      if (!userId) {
        setLists((current) => ({ ...current, [nextTab]: [] }));
        setErrors((current) => ({
          ...current,
          [nextTab]: 'This profile isn’t available.',
        }));
        return;
      }

      setLoading((current) => ({ ...current, [nextTab]: true }));
      setErrors((current) => ({ ...current, [nextTab]: null }));

      try {
        const users = await fetchFollowList(userId, nextTab, accessToken);
        setLists((current) => ({ ...current, [nextTab]: users }));
      } catch (loadError) {
        setErrors((current) => ({
          ...current,
          [nextTab]: toUserFacingError(
            loadError,
            'Couldn’t load that list right now.'
          ),
        }));
      } finally {
        setLoading((current) => ({ ...current, [nextTab]: false }));
      }
    },
    [accessToken, userId]
  );

  useEffect(() => {
    if (lists[tab] || loading[tab]) {
      return;
    }
    void loadTab(tab);
  }, [lists, loadTab, loading, tab]);

  const users = lists[tab] ?? [];
  const isLoading = Boolean(loading[tab]) && users.length === 0;
  const error = errors[tab] ?? null;
  const title = headerUsername
    ? `@${headerUsername}`
    : tab === 'followers'
      ? 'Followers'
      : 'Following';

  const updateUserFollow = (targetId: string, isFollowing: boolean) => {
    setLists((current) => {
      const next: Partial<Record<FollowListKind, FollowListUser[]>> = {};
      for (const key of ['followers', 'following'] as const) {
        const list = current[key];
        if (!list) {
          continue;
        }
        next[key] = list.map((user) =>
          user.id === targetId ? { ...user, isFollowing } : user
        );
      }
      return { ...current, ...next };
    });
  };

  const handleFollowPress = async (user: FollowListUser) => {
    if (busyId) {
      return;
    }

    if (!accessToken) {
      guardedNavigate('login-to-follow', () => {
        router.push('/signup');
      });
      return;
    }

    setBusyId(user.id);
    try {
      const next = user.isFollowing
        ? await unfollowUser(user.id, accessToken, followListUserAsProfile(user))
        : await followUser(user.id, accessToken, followListUserAsProfile(user));
      updateUserFollow(user.id, next.isFollowing);
      captureAnalyticsEvent(
        next.isFollowing ? 'user_followed' : 'user_unfollowed',
        { followed_user_id: user.id }
      );
    } catch (followError) {
      Alert.alert(
        user.isFollowing ? 'Couldn’t unfollow' : 'Couldn’t follow',
        toMutationError(followError, 'Try again in a sec.')
      );
    } finally {
      setBusyId(null);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/profile');
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title={title} onBack={goBack} />
      <View className="self-center w-full max-w-[640px] px-6 pt-4">
        <View className="flex-row rounded-2xl bg-surface-soft p-1">
          <FeedbackPressable
            haptic="selection"
            onPress={() => {
              setTab('followers');
            }}
            className={`min-h-12 flex-1 items-center justify-center rounded-xl py-3 ${
              tab === 'followers' ? 'bg-accent' : ''
            }`}
            accessibilityRole="tab"
            accessibilityLabel="Followers"
            accessibilityState={{ selected: tab === 'followers' }}
          >
            <Text
              className={`font-outfit-bold text-xs ${
                tab === 'followers' ? 'text-brand' : 'text-muted'
              }`}
            >
              Followers
            </Text>
          </FeedbackPressable>
          <FeedbackPressable
            haptic="selection"
            onPress={() => {
              setTab('following');
            }}
            className={`min-h-12 flex-1 items-center justify-center rounded-xl py-3 ${
              tab === 'following' ? 'bg-accent' : ''
            }`}
            accessibilityRole="tab"
            accessibilityLabel="Following"
            accessibilityState={{ selected: tab === 'following' }}
          >
            <Text
              className={`font-outfit-bold text-xs ${
                tab === 'following' ? 'text-brand' : 'text-muted'
              }`}
            >
              Following
            </Text>
          </FeedbackPressable>
        </View>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="self-center w-full max-w-[640px] px-6 pb-8 pt-4"
      >
        {isLoading ? (
          <View
            className="items-center py-16"
            accessibilityLabel={
              tab === 'followers' ? 'Loading followers' : 'Loading following'
            }
          >
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : error && users.length === 0 ? (
          <View className="rounded-2xl border border-errorBorder bg-errorSurface px-4 py-4">
            <Text
              accessibilityRole="alert"
              className="font-outfit-medium text-base text-errorText"
            >
              {error}
            </Text>
            <FeedbackPressable
              onPress={() => {
                void loadTab(tab);
              }}
              className="mt-3 self-start rounded-xl bg-accent px-3 py-2"
              accessibilityRole="button"
              accessibilityLabel="Retry loading list"
            >
              <Text className="font-outfit-bold text-sm text-brand">Retry</Text>
            </FeedbackPressable>
          </View>
        ) : users.length === 0 ? (
          <View className="items-center rounded-2xl bg-field px-6 py-10">
            <Text className="font-outfit-bold text-lg text-ink">
              {tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            </Text>
            <Text className="mt-2 text-center font-outfit-medium text-base leading-5 text-muted">
              {tab === 'followers'
                ? 'When skaters follow this profile, they show up here.'
                : 'When this skater follows people, they show up here.'}
            </Text>
          </View>
        ) : (
          <View className="overflow-hidden rounded-2xl bg-field">
            {users.map((user, index) => (
              <ProfileFollowRow
                key={user.id}
                user={user}
                currentUserId={currentUserId}
                showFollowButton={Boolean(accessToken) && user.id !== currentUserId}
                followBusy={busyId === user.id}
                showDivider={index > 0}
                onFollowPress={(nextUser) => {
                  void handleFollowPress(nextUser);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
