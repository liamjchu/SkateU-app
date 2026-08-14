import { Feather, Octicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { formatCompactRelativeTime } from '../lib/relativeTime';
import type { Spot } from '../types/spot';
import FeedbackPressable from './FeedbackPressable';

type HomeSpotPostProps = {
  spot: Spot;
  isLiking: boolean;
  onLike: (spot: Spot) => void;
  onViewMap: (spot: Spot) => void;
};

function spotAttribution(spot: Spot): string {
  const who = spot.creatorUsername ? `@${spot.creatorUsername}` : 'A skater';
  const when = formatCompactRelativeTime(spot.createdAt);
  return when ? `${who} · ${when}` : who;
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
}: HomeSpotPostProps) {
  const liked = spot.likedByUser === true;
  const imageUrl = spot.imageUris[0];

  return (
    <View className="overflow-hidden rounded-3xl bg-surface-tinted">
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          className="h-56 w-full bg-surface-tinted"
          resizeMode="cover"
          accessibilityLabel={`Photo of ${spot.name}`}
        />
      ) : (
        <View
          className="h-56 w-full items-center justify-center bg-surface-soft"
          accessibilityLabel={`No photo for ${spot.name}`}
        >
          <Feather name="map-pin" size={28} color="#52645F" />
        </View>
      )}

      <View className="px-4 py-3">
        <Text
          numberOfLines={1}
          className="font-outfit-medium text-sm text-muted"
        >
          {spotAttribution(spot)}
        </Text>
        <Text
          numberOfLines={1}
          className="mt-1 font-outfit-bold text-lg text-ink"
        >
          {spot.name}
        </Text>
        <Text
          numberOfLines={1}
          className="mt-0.5 font-outfit-medium text-sm text-muted"
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

        <View className="mt-3 flex-row items-center">
          <FeedbackPressable
            haptic="light"
            onPress={() => onLike(spot)}
            disabled={isLiking}
            className="min-h-11 flex-row items-center rounded-full bg-surface-soft px-3.5"
            accessibilityRole="button"
            accessibilityLabel={
              liked ? `Unlike ${spot.name}` : `Like ${spot.name}`
            }
            accessibilityState={{ selected: liked, busy: isLiking }}
          >
            {isLiking ? (
              <ActivityIndicator size="small" color="#7F302C" />
            ) : (
              <Octicons
                name={liked ? 'heart-fill' : 'heart'}
                size={17}
                color={liked ? '#7F302C' : '#52645F'}
              />
            )}
            <Text className="ml-1.5 font-outfit-semibold text-sm text-muted">
              {spot.likeCount ?? 0}
            </Text>
          </FeedbackPressable>

          <FeedbackPressable
            haptic="light"
            onPress={() => onViewMap(spot)}
            className="ml-2 min-h-11 flex-1 flex-row items-center justify-center rounded-full bg-white px-3.5"
            accessibilityRole="button"
            accessibilityLabel={`View ${spot.name} on the campus map`}
            accessibilityHint="Opens the campus map with this spot selected"
          >
            <Feather name="map" size={16} color="#21473F" />
            <Text className="ml-1.5 font-outfit-bold text-sm text-brand">
              View map
            </Text>
          </FeedbackPressable>
        </View>
      </View>
    </View>
  );
}
