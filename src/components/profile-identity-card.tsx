import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { XP_RANK_LABELS, type XpRank } from '../lib/xpRank';
import FeedbackPressable from './FeedbackPressable';
import ProfileAvatar from './ProfileAvatar';
import ProfileBioText from './ProfileBioText';

const AVATAR_SIZE = 86;

type ProfileStatProps = {
  value: number;
  label: string;
  onPress?: () => void;
  accessibilityLabel: string;
};

function ProfileStat({
  value,
  label,
  onPress,
  accessibilityLabel,
}: ProfileStatProps) {
  const content = (
    <>
      <Text className="text-center font-outfit-black text-base text-ink">
        {value}
      </Text>
      <Text
        className="mt-0.5 text-center font-outfit-medium text-[11px] leading-3 text-muted"
        numberOfLines={1}
      >
        {label}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <FeedbackPressable
        haptic="selection"
        onPress={onPress}
        className="min-w-0 flex-1 items-center"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </FeedbackPressable>
    );
  }

  return (
    <View
      className="min-w-0 flex-1 items-center"
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      {content}
    </View>
  );
}

type ProfileIdentityCardProps = {
  uri?: string | null;
  rank: XpRank;
  displayName: string;
  spotCount: number;
  followerCount: number;
  followingCount: number;
  bio: string | null;
  onFollowersPress: () => void;
  onFollowingPress: () => void;
  onAvatarPress?: () => void;
  avatarAccessibilityLabel?: string;
  avatarBusy?: boolean;
  avatarOverlay?: ReactNode;
  children?: ReactNode;
};

export default function ProfileIdentityCard({
  uri,
  rank,
  displayName,
  spotCount,
  followerCount,
  followingCount,
  bio,
  onFollowersPress,
  onFollowingPress,
  onAvatarPress,
  avatarAccessibilityLabel,
  avatarBusy = false,
  avatarOverlay,
  children,
}: ProfileIdentityCardProps) {
  const avatar = (
    <View>
      <ProfileAvatar
        uri={uri}
        size={AVATAR_SIZE}
        iconSize={36}
        rank={rank}
      />
      {avatarOverlay}
    </View>
  );

  return (
    <View className="rounded-2xl bg-field p-5">
      <View className="flex-row items-start">
        {onAvatarPress ? (
          <FeedbackPressable
            haptic="selection"
            onPress={onAvatarPress}
            disabled={avatarBusy}
            accessibilityRole="button"
            accessibilityLabel={avatarAccessibilityLabel}
            accessibilityState={{ busy: avatarBusy, disabled: avatarBusy }}
          >
            {avatar}
          </FeedbackPressable>
        ) : (
          avatar
        )}

        <View className="ml-4 min-w-0 flex-1 justify-center pt-0.5">
          <Text
            className="font-outfit-black text-2xl leading-7 text-ink"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {displayName}
          </Text>
          <Text
            className="mt-0.5 font-outfit-bold text-base leading-5 text-ink"
            numberOfLines={1}
          >
            {XP_RANK_LABELS[rank]}
          </Text>

          <View className="mt-3 flex-row">
            <ProfileStat
              value={spotCount}
              label="spots"
              accessibilityLabel={`${spotCount} spots`}
            />
            <ProfileStat
              value={followerCount}
              label="followers"
              onPress={onFollowersPress}
              accessibilityLabel={`${followerCount} followers`}
            />
            <ProfileStat
              value={followingCount}
              label="following"
              onPress={onFollowingPress}
              accessibilityLabel={`${followingCount} following`}
            />
          </View>
        </View>
      </View>

      {bio ? (
        <View className="mt-4">
          <ProfileBioText
            bio={bio}
            className="text-left font-outfit-medium text-sm leading-5 text-muted"
          />
        </View>
      ) : null}

      {children}
    </View>
  );
}
