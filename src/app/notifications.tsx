import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import FeedbackPressable from '../components/FeedbackPressable';
import NotificationRow from '../components/notification-row';
import ScreenHeader from '../components/screen-header';
import { colors } from '../constants/colors';
import { captureAnalyticsEvent } from '../lib/analytics';
import { guardedNavigate, useGuardedRouter } from '../lib/navigationGuard';
import { notificationRoute } from '../lib/notifications';
import { toMutationError } from '../lib/userFacingError';
import { openUserProfile } from '../lib/userProfileNavigation';
import { useAuthStore } from '../store/authStore';
import { useNotificationsStore } from '../store/notificationsStore';
import type { UserNotification } from '../types/notification';

export default function NotificationsScreen() {
  const router = useGuardedRouter();
  const accessToken = useAuthStore((state) => state.session?.access_token ?? null);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const items = useNotificationsStore((state) => state.items);
  const loading = useNotificationsStore((state) => state.loading);
  const error = useNotificationsStore((state) => state.error);
  const fetchNotifications = useNotificationsStore(
    (state) => state.fetchNotifications
  );
  const markAllRead = useNotificationsStore((state) => state.markAllRead);
  const hideNotification = useNotificationsStore(
    (state) => state.hideNotification
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) {
        return;
      }

      let cancelled = false;
      void (async () => {
        await fetchNotifications(accessToken);
        if (cancelled || useNotificationsStore.getState().error) {
          return;
        }
        if (useNotificationsStore.getState().unreadCount === 0) {
          return;
        }
        await markAllRead(accessToken).catch(() => undefined);
      })();

      return () => {
        cancelled = true;
      };
    }, [accessToken, fetchNotifications, markAllRead])
  );

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  const handleRefresh = () => {
    if (!accessToken) {
      return;
    }
    setIsRefreshing(true);
    void fetchNotifications(accessToken).finally(() => {
      setIsRefreshing(false);
    });
  };

  const handleActorPress = (notification: UserNotification) => {
    if (!notification.actorId) {
      return;
    }
    captureAnalyticsEvent('notification_actor_opened', {
      type: notification.type,
    });
    openUserProfile(router, notification.actorId, currentUserId);
  };

  const handlePress = (notification: UserNotification) => {
    const route = notificationRoute(notification);
    captureAnalyticsEvent('notification_opened', { type: notification.type });
    if (route.kind === 'comments') {
      guardedNavigate(`comments:${route.spotId}`, () => {
        router.push({
          pathname: '/spot-comments',
          params: { spotId: route.spotId, spotName: route.spotName },
        });
      });
      return;
    }
    if (route.kind === 'profile') {
      openUserProfile(router, route.userId, currentUserId);
    }
  };

  const handleHide = (notification: UserNotification) => {
    if (!accessToken) {
      return;
    }
    captureAnalyticsEvent('notification_hidden', { type: notification.type });
    void hideNotification(notification.id, accessToken).catch(
      (caught: unknown) => {
        Alert.alert(
          'Couldn’t hide that',
          toMutationError(caught, 'Please try again.')
        );
      }
    );
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Notifications" onBack={goBack} />
      {!accessToken ? (
        <View className="px-6 pt-8">
          <Text className="font-outfit-medium text-base text-muted">
            Sign in to see likes, comments, and new followers.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <NotificationRow
              notification={item}
              onPress={handlePress}
              onActorPress={handleActorPress}
              onHide={handleHide}
              showDivider={index > 0}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            loading ? (
              <View
                className="items-center py-16"
                accessibilityLabel="Loading notifications"
              >
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : error ? (
              <View className="mx-6 mt-8 rounded-2xl border border-errorBorder bg-errorSurface px-4 py-4">
                <Text
                  accessibilityRole="alert"
                  className="font-outfit-medium text-base text-errorText"
                >
                  {error}
                </Text>
                <FeedbackPressable
                  onPress={() => {
                    void fetchNotifications(accessToken);
                  }}
                  className="mt-3 self-start rounded-xl bg-accent px-3 py-2"
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading notifications"
                >
                  <Text className="font-outfit-bold text-sm text-brand">
                    Retry
                  </Text>
                </FeedbackPressable>
              </View>
            ) : (
              <View className="mx-6 mt-8 items-center rounded-2xl bg-field px-5 py-10">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-surface-soft">
                  <Feather name="bell" size={22} color={colors.muted} />
                </View>
                <Text className="mt-4 font-outfit-bold text-lg text-ink">
                  No notifications yet
                </Text>
                <Text className="mt-2 text-center font-outfit-medium text-base leading-5 text-muted">
                  When someone likes your spot, comments, replies, or follows you, it shows up here.
                </Text>
              </View>
            )
          }
          contentContainerClassName="pb-8 pt-2"
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
