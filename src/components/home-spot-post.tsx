import { Feather, Octicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../lib/navigationGuard';
import { ActivityIndicator, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { formatCompactRelativeTime } from '../lib/relativeTime';
import { openUserProfile } from '../lib/userProfileNavigation';
import { useAuthStore } from '../store/authStore';
import type { Spot } from '../types/spot';
import CreatorAttribution from './creator-attribution';
import FeedbackPressable from './FeedbackPressable';
import ProfileAvatar from './ProfileAvatar';
import SpotMediaPager from './spot-media-pager';

type HomeSpotPostProps = {
  spot: Spot;
  isLiking: boolean;
  onLike: (spot: Spot) => void;
  onViewMap: (spot: Spot) => void;
  onOpenComments: (spot: Spot) => void;
  onOpenFullscreen: (spot: Spot, photoIndex: number) => void;
};

function spotAttributionSuffix(spot: Spot): string {
  const when = formatCompactRelativeTime(spot.createdAt);
  return when ? ` · ${when}` : '';
}

function spotPlace(spot: Spot): string {
  const school = spot.schoolName || 'Campus map';
  if (spot.city && spot.state) {
    return `${school} · ${spot.city}, ${spot.state}`;
  }

  return school;
}

export default function HomeSpotPost({
  spot,
  isLiking,
  onLike,
  onViewMap,
  onOpenComments,
  onOpenFullscreen,
}: HomeSpotPostProps) {
  const liked = spot.likedByUser === true;
  const imageUris = spot.imageUris.filter((uri) => uri.length > 0);
  const router = useGuardedRouter();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  return (
    <View className="overflow-hidden rounded-2xl bg-field">
      {imageUris.length > 0 ? (
        <SpotMediaPager
          uris={imageUris}
          height={224}
          onPressIndex={(index) => onOpenFullscreen(spot, index)}
          accessibilityName={spot.name}
        />
      ) : (
        <FeedbackPressable
          haptic="light"
          disablePressScale
          onPress={() => onOpenFullscreen(spot, 0)}
          className="h-56 w-full items-center justify-center bg-surface-soft"
          accessibilityRole="button"
          accessibilityLabel={`Open full screen view of ${spot.name}`}
        >
          <Feather name="image" size={28} color={colors.muted} />
          <Text className="mt-2 font-outfit-medium text-sm text-muted">
            No photo yet
          </Text>
        </FeedbackPressable>
      )}

      <View className="px-4 pt-4">
        <View className="flex-row items-center">
          {spot.creatorUserId ? (
            <FeedbackPressable
              haptic="selection"
              onPress={() => {
                openUserProfile(router, spot.creatorUserId as string, currentUserId);
              }}
              accessibilityRole="link"
              accessibilityLabel={
                spot.creatorUsername
                  ? `Open @${spot.creatorUsername}'s profile`
                  : 'Open profile'
              }
            >
              <ProfileAvatar uri={spot.creatorAvatarUrl} size={16} iconSize={10} />
            </FeedbackPressable>
          ) : (
            <ProfileAvatar uri={spot.creatorAvatarUrl} size={16} iconSize={10} />
          )}
          <CreatorAttribution
            userId={spot.creatorUserId}
            username={spot.creatorUsername}
            fallback="A skater"
            suffix={spotAttributionSuffix(spot)}
            numberOfLines={1}
            className="ml-1.5 min-w-0 flex-1 font-outfit-medium text-sm text-muted"
          />
        </View>
        <FeedbackPressable
          haptic="light"
          disablePressScale
          onPress={() => onOpenFullscreen(spot, 0)}
          accessibilityRole="button"
          accessibilityLabel={`Open full screen view of ${spot.name}`}
        >
          <View className="mt-1 flex-row items-center">
            <Text
              numberOfLines={1}
              className="min-w-0 flex-1 font-outfit-bold text-lg text-ink"
            >
              {spot.name}
            </Text>
            <Feather name="chevron-right" size={18} color={colors.mutedSoft} />
          </View>
          <Text
            numberOfLines={1}
            className="mt-0.5 font-outfit-medium text-sm text-muted-soft"
          >
            {spotPlace(spot)}
          </Text>
          {spot.description.trim().length > 0 ? (
            <Text
              numberOfLines={2}
              className="mt-2 font-outfit-medium text-sm leading-5 text-ink"
            >
              {spot.description.trim()}
            </Text>
          ) : null}
        </FeedbackPressable>
      </View>

      <View className="flex-row items-center px-4 pb-4 pt-3">
        <FeedbackPressable
          haptic="light"
          onPress={() => onLike(spot)}
          disabled={isLiking}
          className={`min-h-11 flex-row items-center rounded-xl px-3.5 ${
            liked ? 'bg-accent' : 'bg-surface-soft'
          }`}
          accessibilityRole="button"
          accessibilityLabel={
            liked ? `Unlike ${spot.name}` : `Like ${spot.name}`
          }
          accessibilityState={{ selected: liked, busy: isLiking }}
        >
          {isLiking ? (
            <ActivityIndicator
              size="small"
              color={liked ? colors.brand : colors.ink}
            />
          ) : (
            <Octicons
              name={liked ? 'heart-fill' : 'heart'}
              size={17}
              color={liked ? colors.brand : colors.ink}
            />
          )}
          <Text
            className={`ml-1.5 font-outfit-semibold text-sm ${
              liked ? 'text-brand' : 'text-ink'
            }`}
          >
            {spot.likeCount ?? 0}
          </Text>
        </FeedbackPressable>

        <FeedbackPressable
          haptic="light"
          onPress={() => onOpenComments(spot)}
          className="ml-2 min-h-11 flex-row items-center rounded-xl bg-surface-soft px-3.5"
          accessibilityRole="button"
          accessibilityLabel={`Comments on ${spot.name}`}
          accessibilityHint="Opens comments for this spot"
        >
          <Feather name="message-circle" size={16} color={colors.ink} />
          <Text className="ml-1.5 font-outfit-semibold text-sm text-ink">
            {spot.commentCount ?? 0}
          </Text>
        </FeedbackPressable>

        <FeedbackPressable
          haptic="light"
          onPress={() => onViewMap(spot)}
          className="ml-2 min-h-11 flex-1 flex-row items-center justify-center rounded-xl bg-surface-soft px-3.5"
          accessibilityRole="button"
          accessibilityLabel={`View ${spot.name} on the campus map`}
          accessibilityHint="Opens the campus map with this spot selected"
        >
          <Feather name="map" size={16} color={colors.ink} />
          <Text className="ml-1.5 font-outfit-bold text-sm text-ink">
            View map
          </Text>
        </FeedbackPressable>
      </View>
    </View>
  );
}
