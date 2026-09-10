import { Feather, Octicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../lib/navigationGuard';
import { Text, View, useWindowDimensions } from 'react-native';
import { colors } from '../constants/colors';
import { formatCompactRelativeTime } from '../lib/relativeTime';
import { openUserProfile } from '../lib/userProfileNavigation';
import { useAuthStore } from '../store/authStore';
import type { Spot } from '../types/spot';
import CreatorAttribution from './creator-attribution';
import FeedbackPressable from './FeedbackPressable';
import ProfileAvatar from './ProfileAvatar';
import SpotMediaPager from './spot-media-pager';

export type HomeSpotPostLayout = 'card' | 'immersive';

type HomeSpotPostProps = {
  spot: Spot;
  onLike: (spot: Spot) => void;
  onViewMap: (spot: Spot) => void;
  onOpenComments: (spot: Spot) => void;
  onOpenFullscreen: (spot: Spot, photoIndex: number) => void;
  layout?: HomeSpotPostLayout;
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
  onLike,
  onViewMap,
  onOpenComments,
  onOpenFullscreen,
  layout = 'card',
}: HomeSpotPostProps) {
  const liked = spot.likedByUser === true;
  const imageUris = spot.imageUris.filter((uri) => uri.length > 0);
  const router = useGuardedRouter();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const { width } = useWindowDimensions();
  const immersive = layout === 'immersive';
  const mediaHeight = immersive
    ? Math.min(Math.round(width * 1.15), 560)
    : 224;

  return (
    <View
      className={
        immersive
          ? 'bg-surface'
          : 'overflow-hidden rounded-2xl bg-field'
      }
    >
      {immersive ? (
        <View className="px-4 pb-3 pt-4">
          <View className="flex-row items-center">
            {spot.creatorUserId ? (
              <FeedbackPressable
                haptic="selection"
                onPress={() => {
                  openUserProfile(
                    router,
                    spot.creatorUserId as string,
                    currentUserId
                  );
                }}
                accessibilityRole="link"
                accessibilityLabel={
                  spot.creatorUsername
                    ? `Open @${spot.creatorUsername}'s profile`
                    : 'Open profile'
                }
              >
                <ProfileAvatar
                  uri={spot.creatorAvatarUrl}
                  size={28}
                  iconSize={12}
                  rank={spot.creatorRank}
                />
              </FeedbackPressable>
            ) : (
              <ProfileAvatar
                uri={spot.creatorAvatarUrl}
                size={28}
                iconSize={12}
                rank={spot.creatorRank}
              />
            )}
            <CreatorAttribution
              userId={spot.creatorUserId}
              username={spot.creatorUsername}
              fallback="A skater"
              suffix={spotAttributionSuffix(spot)}
              numberOfLines={1}
              className="ml-2 min-w-0 flex-1 font-outfit-semibold text-sm text-ink"
            />
          </View>
        </View>
      ) : null}

      {imageUris.length > 0 ? (
        <SpotMediaPager
          uris={imageUris}
          height={mediaHeight}
          onPressIndex={(index) => onOpenFullscreen(spot, index)}
          accessibilityName={spot.name}
        />
      ) : (
        <FeedbackPressable
          haptic="light"
          disablePressScale
          onPress={() => onOpenFullscreen(spot, 0)}
          className={`${immersive ? 'h-72' : 'h-56'} w-full items-center justify-center bg-surface-soft`}
          accessibilityRole="button"
          accessibilityLabel={`Open full screen view of ${spot.name}`}
        >
          <Feather name="image" size={28} color={colors.muted} />
          <Text className="mt-2 font-outfit-medium text-sm text-muted">
            No photo yet
          </Text>
        </FeedbackPressable>
      )}

      <View className={immersive ? 'px-4 pt-3' : 'px-4 pt-4'}>
        {immersive ? null : (
          <View className="flex-row items-center">
            {spot.creatorUserId ? (
              <FeedbackPressable
                haptic="selection"
                onPress={() => {
                  openUserProfile(
                    router,
                    spot.creatorUserId as string,
                    currentUserId
                  );
                }}
                accessibilityRole="link"
                accessibilityLabel={
                  spot.creatorUsername
                    ? `Open @${spot.creatorUsername}'s profile`
                    : 'Open profile'
                }
              >
                <ProfileAvatar
                  uri={spot.creatorAvatarUrl}
                  size={16}
                  iconSize={10}
                  rank={spot.creatorRank}
                />
              </FeedbackPressable>
            ) : (
              <ProfileAvatar
                uri={spot.creatorAvatarUrl}
                size={16}
                iconSize={10}
                rank={spot.creatorRank}
              />
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
        )}
        <FeedbackPressable
          haptic="light"
          disablePressScale
          onPress={() => onOpenFullscreen(spot, 0)}
          accessibilityRole="button"
          accessibilityLabel={`Open full screen view of ${spot.name}`}
        >
          <View className={`${immersive ? 'mt-0' : 'mt-1'} flex-row items-center`}>
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
              numberOfLines={immersive ? 3 : 2}
              className="mt-2 font-outfit-medium text-sm leading-5 text-ink"
            >
              {spot.description.trim()}
            </Text>
          ) : null}
        </FeedbackPressable>
      </View>

      <View
        className={`flex-row items-center px-4 ${immersive ? 'pb-5 pt-3' : 'pb-4 pt-3'}`}
      >
        <FeedbackPressable
          haptic="light"
          onPress={() => onLike(spot)}
          className={`min-h-11 flex-row items-center rounded-xl px-3.5 ${
            liked ? 'bg-accent' : 'bg-surface-soft'
          }`}
          accessibilityRole="button"
          accessibilityLabel={
            liked ? `Unlike ${spot.name}` : `Like ${spot.name}`
          }
          accessibilityState={{ selected: liked }}
        >
          <Octicons
            name={liked ? 'heart-fill' : 'heart'}
            size={17}
            color={liked ? colors.brand : colors.ink}
          />
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
          accessibilityHint="Opens the map with this spot selected"
        >
          <Feather name="map" size={16} color={colors.ink} />
          <Text className="ml-1.5 font-outfit-bold text-sm text-ink">
            View map
          </Text>
        </FeedbackPressable>
      </View>
      {immersive ? <View className="h-px bg-borderSoft" /> : null}
    </View>
  );
}
