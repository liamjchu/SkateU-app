import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useNotificationsStore } from '../store/notificationsStore';

export function useNotificationBadge(accessToken: string | null): number {
  const unreadCount = useNotificationsStore((state) => state.unreadCount);
  const fetchUnreadCount = useNotificationsStore(
    (state) => state.fetchUnreadCount
  );

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) {
        return;
      }

      const controller = new AbortController();
      void fetchUnreadCount(accessToken, controller.signal);
      return () => {
        controller.abort();
      };
    }, [accessToken, fetchUnreadCount])
  );

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const onChange = (status: AppStateStatus) => {
      if (status === 'active') {
        void fetchUnreadCount(accessToken);
      }
    };

    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [accessToken, fetchUnreadCount]);

  return unreadCount;
}
