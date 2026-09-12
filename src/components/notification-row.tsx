import { Feather } from '@expo/vector-icons';
import { Platform, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { colors } from '../constants/colors';
import {
  formatXpDeltaLabel,
  notificationCopy,
  notificationRoute,
  notificationXpDelta,
} from '../lib/notifications';
import { formatCompactRelativeTime } from '../lib/relativeTime';
import type { UserNotification } from '../types/notification';
import CachedRemoteImage from './CachedRemoteImage';
import FeedbackPressable from './FeedbackPressable';
import ProfileAvatar from './ProfileAvatar';

type NotificationRowProps = {
  notification: UserNotification;
  onPress: (notification: UserNotification) => void;
  onActorPress: (notification: UserNotification) => void;
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
  onActorPress,
  onHide,
  showDivider,
}: NotificationRowProps) {
  const unread = notification.readAt === null;
  const timeLabel = formatCompactRelativeTime(notification.createdAt);
  const showWebHide = Platform.OS === 'web';
  const { actor, rest } = notificationCopy(notification);
  const xpDelta = notificationXpDelta(notification.type);
  const canOpenActor = Boolean(notification.actorId);
  const canOpenActivity =
    notificationRoute(notification).kind !== 'none';
  const weightClass = unread ? 'font-outfit-semibold' : 'font-outfit-medium';

  const row = (
    <View
      className={`flex-row items-center bg-surface px-6 py-3 ${
        showDivider ? 'border-t border-border-soft' : ''
      }`}
    >
      <FeedbackPressable
        haptic="selection"
        onPress={() => onActorPress(notification)}
        disabled={!canOpenActor}
        className="shrink-0"
        accessibilityRole="button"
        accessibilityLabel={
          canOpenActor ? `Open ${actor}’s profile` : undefined
        }
        accessibilityState={{ disabled: !canOpenActor }}
      >
        <ProfileAvatar
          uri={notification.actorAvatarUrl}
          size={44}
          rank={notification.actorRank ?? null}
        />
      </FeedbackPressable>
      <View className="ml-3 min-w-0 flex-1">
        <View className="flex-row flex-wrap items-center">
          <FeedbackPressable
            haptic="selection"
            onPress={() => onActorPress(notification)}
            disabled={!canOpenActor}
            accessibilityRole="button"
            accessibilityLabel={
              canOpenActor ? `Open ${actor}’s profile` : actor
            }
            accessibilityState={{ disabled: !canOpenActor }}
          >
            <Text
              className={`text-base leading-5 text-ink ${
                unread ? 'font-outfit-bold' : 'font-outfit-semibold'
              }`}
            >
              {actor}
            </Text>
          </FeedbackPressable>
          <FeedbackPressable
            haptic="selection"
            onPress={() => onPress(notification)}
            disabled={!canOpenActivity}
            className="min-w-0"
            accessibilityRole={canOpenActivity ? 'button' : 'text'}
            accessibilityLabel={`${rest}${timeLabel ? `, ${timeLabel}` : ''}${
              unread ? ', unread' : ''
            }`}
            accessibilityHint={
              canOpenActivity ? 'Opens this activity' : undefined
            }
            accessibilityState={{ disabled: !canOpenActivity }}
          >
            <Text className={`text-base leading-5 text-ink ${weightClass}`}>
              {` ${rest}`}
            </Text>
          </FeedbackPressable>
        </View>
        <View className="mt-1 flex-row flex-wrap items-center">
          {timeLabel ? (
            <Text className="font-outfit-medium text-sm text-muted">
              {timeLabel}
            </Text>
          ) : null}
          {xpDelta != null ? (
            <View className="ml-2 rounded-full bg-surface-soft px-2 py-0.5">
              <Text className="font-outfit-bold text-xs text-accent">
                {formatXpDeltaLabel(xpDelta)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {notification.spotImageUrl ? (
        <FeedbackPressable
          haptic="selection"
          onPress={() => onPress(notification)}
          disabled={!canOpenActivity}
          className="ml-3"
          accessibilityRole="button"
          accessibilityLabel={`Open ${notification.spotName ?? 'spot'}`}
          accessibilityState={{ disabled: !canOpenActivity }}
        >
          <CachedRemoteImage
            uri={notification.spotImageUrl}
            className="h-11 w-11 rounded-xl"
            style={{ width: 44, height: 44, borderRadius: 12 }}
          />
        </FeedbackPressable>
      ) : null}
      {unread ? (
        <View
          className="ml-2 h-2.5 w-2.5 rounded-full bg-accent"
          accessible={false}
        />
      ) : (
        <View className="ml-2 h-2.5 w-2.5" accessible={false} />
      )}
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
