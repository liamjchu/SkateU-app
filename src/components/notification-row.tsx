import { Feather } from '@expo/vector-icons';
import { Platform, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { colors } from '../constants/colors';
import { formatCompactRelativeTime } from '../lib/relativeTime';
import type { UserNotification } from '../types/notification';
import CachedRemoteImage from './CachedRemoteImage';
import FeedbackPressable from './FeedbackPressable';
import ProfileAvatar from './ProfileAvatar';

type NotificationRowProps = {
  notification: UserNotification;
  onPress: (notification: UserNotification) => void;
  onHide: (notification: UserNotification) => void;
  showDivider: boolean;
};

function HideAction({ onPress }: { onPress: () => void }) {
  return (
    <FeedbackPressable
      haptic="light"
      onPress={onPress}
      className="h-full w-20 items-center justify-center bg-brand"
      accessibilityRole="button"
      accessibilityLabel="Hide notification"
    >
      <Text className="font-outfit-bold text-sm text-white">Hide</Text>
    </FeedbackPressable>
  );
}

export default function NotificationRow({
  notification,
  onPress,
  onHide,
  showDivider,
}: NotificationRowProps) {
  const unread = notification.readAt === null;
  const timeLabel = formatCompactRelativeTime(notification.createdAt);
  const showWebHide = Platform.OS === 'web';

  const row = (
    <View
      className={`flex-row items-center bg-surface px-6 py-3 ${
        showDivider ? 'border-t border-border-soft' : ''
      }`}
    >
      <FeedbackPressable
        haptic="selection"
        onPress={() => onPress(notification)}
        className="min-w-0 flex-1 flex-row items-center"
        accessibilityRole="button"
        accessibilityLabel={`${notification.body}${
          timeLabel ? `, ${timeLabel}` : ''
        }${unread ? ', unread' : ''}`}
        accessibilityHint="Opens this activity"
        accessibilityActions={[{ name: 'hide', label: 'Hide notification' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'hide') {
            onHide(notification);
          }
        }}
      >
        <ProfileAvatar
          uri={notification.actorAvatarUrl}
          size={44}
          rank={notification.actorRank ?? null}
        />
        <View className="ml-3 min-w-0 flex-1">
          <Text
            className={`text-base leading-5 text-ink ${
              unread ? 'font-outfit-semibold' : 'font-outfit-medium'
            }`}
          >
            {notification.body}
          </Text>
          {timeLabel ? (
            <Text className="mt-1 font-outfit-medium text-sm text-muted">
              {timeLabel}
            </Text>
          ) : null}
        </View>
        {notification.spotImageUrl ? (
          <CachedRemoteImage
            uri={notification.spotImageUrl}
            className="ml-3 h-11 w-11 rounded-xl"
            style={{ width: 44, height: 44, borderRadius: 12 }}
          />
        ) : null}
        {unread ? (
          <View
            className="ml-2 h-2.5 w-2.5 rounded-full bg-accent"
            accessible={false}
          />
        ) : (
          <View className="ml-2 h-2.5 w-2.5" accessible={false} />
        )}
      </FeedbackPressable>
      {showWebHide ? (
        <FeedbackPressable
          haptic="selection"
          onPress={() => onHide(notification)}
          className="ml-1 h-9 w-9 items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel="Hide notification"
        >
          <Feather name="x" size={18} color={colors.muted} />
        </FeedbackPressable>
      ) : null}
    </View>
  );

  if (showWebHide) {
    return row;
  }

  return (
    <Swipeable
      friction={2}
      overshootLeft={false}
      renderLeftActions={() => (
        <HideAction onPress={() => onHide(notification)} />
      )}
    >
      {row}
    </Swipeable>
  );
}
