import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../constants/colors';
import { openUserProfile } from '../lib/userProfileNavigation';
import type { FollowListUser } from '../types/publicProfile';
import FeedbackPressable from './FeedbackPressable';
import ProfileAvatar from './ProfileAvatar';

type ProfileFollowRowProps = {
  user: FollowListUser;
  currentUserId: string | null;
  showFollowButton: boolean;
  followBusy: boolean;
  showDivider: boolean;
  onFollowPress: (user: FollowListUser) => void;
};

export default function ProfileFollowRow({
  user,
  currentUserId,
  showFollowButton,
  followBusy,
  showDivider,
  onFollowPress,
}: ProfileFollowRowProps) {
  const router = useRouter();
  const label = user.username ? `@${user.username}` : 'A skater';

  return (
    <View
      className={`min-h-14 flex-row items-center px-4 py-3 ${
        showDivider ? 'border-t border-border-soft' : ''
      }`}
    >
      <FeedbackPressable
        haptic="selection"
        onPress={() => {
          openUserProfile(router, user.id, currentUserId);
        }}
        className="min-w-0 flex-1 flex-row items-center"
        accessibilityRole="link"
        accessibilityLabel={`Open ${label}'s profile`}
      >
        <ProfileAvatar uri={user.avatarUrl} size={40} iconSize={18} />
        <Text
          className="ml-3 min-w-0 flex-1 font-outfit-semibold text-base text-ink"
          numberOfLines={1}
        >
          {label}
        </Text>
      </FeedbackPressable>
      {showFollowButton ? (
        <FeedbackPressable
          haptic="light"
          onPress={() => {
            onFollowPress(user);
          }}
          disabled={followBusy}
          className={`ml-3 h-9 min-w-[88px] items-center justify-center rounded-xl px-3 ${
            user.isFollowing ? 'bg-surface-soft' : 'bg-brand'
          }`}
          accessibilityRole="button"
          accessibilityLabel={user.isFollowing ? 'Unfollow' : 'Follow'}
          accessibilityState={{ busy: followBusy, disabled: followBusy }}
        >
          {followBusy ? (
            <ActivityIndicator
              size="small"
              color={user.isFollowing ? colors.ink : colors.white}
            />
          ) : (
            <Text
              className={`font-outfit-bold text-sm ${
                user.isFollowing ? 'text-ink' : 'text-white'
              }`}
            >
              {user.isFollowing ? 'Following' : 'Follow'}
            </Text>
          )}
        </FeedbackPressable>
      ) : null}
    </View>
  );
}
