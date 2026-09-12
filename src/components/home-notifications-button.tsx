import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useNotificationBadge } from '../hooks/useNotificationBadge';
import { captureAnalyticsEvent } from '../lib/analytics';
import {
  formatNotificationsA11yLabel,
  formatUnreadBadge,
} from '../lib/notifications';
import { guardedNavigate, useGuardedRouter } from '../lib/navigationGuard';
import FeedbackPressable from './FeedbackPressable';
import LoginRequiredModal from './LoginRequiredModal';

type HomeNotificationsButtonProps = {
  accessToken: string | null;
};

export default function HomeNotificationsButton({
  accessToken,
}: HomeNotificationsButtonProps) {
  const router = useGuardedRouter();
  const unreadCount = useNotificationBadge(accessToken);
  const badge = accessToken ? formatUnreadBadge(unreadCount) : null;
  const [showLoginRequired, setShowLoginRequired] = useState(false);

  const handlePress = () => {
    if (!accessToken) {
      setShowLoginRequired(true);
      return;
    }

    captureAnalyticsEvent('notifications_opened');
    guardedNavigate('notifications', () => {
      router.push('/notifications');
    });
  };

  return (
    <>
      <FeedbackPressable
        haptic="light"
        onPress={handlePress}
        className="h-11 w-11 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={formatNotificationsA11yLabel(
          accessToken ? unreadCount : 0
        )}
      >
        <Feather name="bell" size={22} color="#FFFFFF" />
        {badge ? (
          <View
            className="absolute right-0 top-0 min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1"
            accessible={false}
          >
            <Text className="font-outfit-bold text-[10px] leading-[14px] text-brand">
              {badge}
            </Text>
          </View>
        ) : null}
      </FeedbackPressable>
      <LoginRequiredModal
        visible={showLoginRequired}
        onCancel={() => setShowLoginRequired(false)}
        title="Sign up to see activity"
        message="Sign up to get notified when someone likes your spots, comments, or follows you. Already have an account? You can log in from the next screen."
      />
    </>
  );
}
