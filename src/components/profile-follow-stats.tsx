import { Text, View } from 'react-native';
import FeedbackPressable from './FeedbackPressable';

type ProfileFollowStatsProps = {
  followerCount: number;
  followingCount: number;
  onFollowersPress: () => void;
  onFollowingPress: () => void;
};

export default function ProfileFollowStats({
  followerCount,
  followingCount,
  onFollowersPress,
  onFollowingPress,
}: ProfileFollowStatsProps) {
  return (
    <View className="mt-4 flex-row items-center justify-center">
      <FeedbackPressable
        haptic="selection"
        onPress={onFollowersPress}
        className="min-w-[88px] items-center px-3"
        accessibilityRole="button"
        accessibilityLabel={`${followerCount} followers`}
      >
        <Text className="font-outfit-black text-lg text-ink">
          {followerCount}
        </Text>
        <Text className="font-outfit-medium text-xs text-muted">Followers</Text>
      </FeedbackPressable>
      <FeedbackPressable
        haptic="selection"
        onPress={onFollowingPress}
        className="min-w-[88px] items-center px-3"
        accessibilityRole="button"
        accessibilityLabel={`${followingCount} following`}
      >
        <Text className="font-outfit-black text-lg text-ink">
          {followingCount}
        </Text>
        <Text className="font-outfit-medium text-xs text-muted">Following</Text>
      </FeedbackPressable>
    </View>
  );
}
