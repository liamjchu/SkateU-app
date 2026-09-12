import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  configurePushNotificationHandler,
  getOsNotificationPermission,
  parsePushNotificationData,
  registerPushToken,
} from '../lib/pushRegistration';
import { notificationRoute, parseNotificationType } from '../lib/notifications';
import { useAuthStore } from '../store/authStore';
import { useNotificationPreferencesStore } from '../store/notificationPreferencesStore';
import { useNotificationsStore } from '../store/notificationsStore';

let handledLastResponse = false;

function openFromPushData(
  router: ReturnType<typeof useRouter>,
  data: ReturnType<typeof parsePushNotificationData>
): void {
  const type = parseNotificationType(data.type);
  if (!type) {
    router.push('/notifications');
    return;
  }
  const route = notificationRoute({
    type,
    actorId: data.userId,
    spotId: data.spotId,
    spotName: data.spotName,
  });
  if (route.kind === 'comments') {
    router.push({
      pathname: '/spot-comments',
      params: { spotId: route.spotId, spotName: route.spotName },
    });
    return;
  }
  if (route.kind === 'profile') {
    router.push({ pathname: '/user/[userId]', params: { userId: route.userId } });
    return;
  }
  router.push('/notifications');
}

export function usePushNotifications(options: {
  enabled: boolean;
}): void {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.session?.access_token ?? null);
  const pushEnabled = useNotificationPreferencesStore(
    (state) => state.preferences.pushEnabled
  );
  const fetchUnreadCount = useNotificationsStore(
    (state) => state.fetchUnreadCount
  );

  useEffect(() => {
    configurePushNotificationHandler();
  }, []);

  useEffect(() => {
    if (!options.enabled || !accessToken || !pushEnabled || Platform.OS === 'web') {
      return;
    }

    let cancelled = false;
    void (async () => {
      const permission = await getOsNotificationPermission();
      if (cancelled || permission !== 'granted') {
        return;
      }
      try {
        await registerPushToken(accessToken);
      } catch {
        // Registration retries on the next granted session.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, options.enabled, pushEnabled]);

  useEffect(() => {
    if (!options.enabled || Platform.OS === 'web') {
      return;
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = parsePushNotificationData(
          response.notification.request.content.data
        );
        if (accessToken) {
          void fetchUnreadCount(accessToken).catch(() => undefined);
        }
        openFromPushData(router, data);
      }
    );

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response || handledLastResponse) {
        return;
      }
      handledLastResponse = true;
      const data = parsePushNotificationData(
        response.notification.request.content.data
      );
      openFromPushData(router, data);
    });

    return () => {
      subscription.remove();
    };
  }, [accessToken, fetchUnreadCount, options.enabled, router]);
}
