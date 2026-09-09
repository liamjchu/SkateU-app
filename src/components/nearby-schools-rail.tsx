import { Feather, Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { colors } from '../constants/colors';
import type { NearbySchoolsStatus } from '../hooks/useNearbySchools';
import {
  schoolDistanceMeters,
  type NearbyOrigin,
} from '../lib/nearbySchools';
import { formatDistanceFromMeters } from '../lib/spotDistance';
import type { School } from '../types/school';
import FeedbackPressable from './FeedbackPressable';
import HomeRailCard, { HomeFeedRail } from './home-rail-card';
import { SchoolSpotCount } from './PopularSchoolCard';

type NearbySchoolsRailProps = {
  schools: School[];
  origin: NearbyOrigin | null;
  status: NearbySchoolsStatus;
  error: string;
  savedSchoolIds: string[];
  onEnableLocation: () => void;
  onRetry: () => void;
  onPress: (school: School) => void;
  onToggleSave: (school: School) => void;
};

type LocationPromptCopy = {
  title: string;
  message: string;
  action: string;
};

function getPromptCopy(status: NearbySchoolsStatus): LocationPromptCopy {
  switch (status) {
    case 'denied':
      return {
        title: 'Location is blocked',
        message:
          'Allow location access in Settings to see the campuses closest to you.',
        action: 'Open Settings',
      };
    case 'unavailable':
      return {
        title: 'Location is off',
        message:
          'Turn on Location Services to see the campuses closest to you.',
        action: 'Open Settings',
      };
    default:
      return {
        title: 'See schools near you',
        message:
          'Share your location to find the campuses closest to you right now.',
        action: 'Turn on location',
      };
  }
}

function EmptyRailCard({
  title,
  message,
  action,
  onAction,
}: {
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View className="h-52 items-center justify-center rounded-2xl bg-field px-4">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent">
        <Feather name="navigation" size={18} color={colors.brand} />
      </View>
      <Text
        numberOfLines={1}
        className="mt-2 text-center font-outfit-bold text-base text-ink"
      >
        {title}
      </Text>
      <Text
        numberOfLines={2}
        className="mt-0.5 text-center font-outfit-medium text-sm leading-5 text-muted"
      >
        {message}
      </Text>
      {action && onAction ? (
        <FeedbackPressable
          haptic="light"
          onPress={onAction}
          className="mt-3 rounded-xl bg-accent px-4 py-2"
          accessibilityRole="button"
          accessibilityLabel={action}
        >
          <Text className="font-outfit-bold text-sm text-brand">{action}</Text>
        </FeedbackPressable>
      ) : null}
    </View>
  );
}

function LocationPrompt({
  status,
  onEnableLocation,
}: {
  status: NearbySchoolsStatus;
  onEnableLocation: () => void;
}) {
  const copy = getPromptCopy(status);

  return (
    <EmptyRailCard
      title={copy.title}
      message={copy.message}
      action={copy.action}
      onAction={onEnableLocation}
    />
  );
}

export default function NearbySchoolsRail({
  schools,
  origin,
  status,
  error,
  savedSchoolIds,
  onEnableLocation,
  onRetry,
  onPress,
  onToggleSave,
}: NearbySchoolsRailProps) {
  const needsLocation =
    status === 'prompt' || status === 'denied' || status === 'unavailable';

  return (
    <HomeFeedRail
      title="Nearby schools"
      subtitle="Campuses closest to you"
      isLoading={
        (status === 'idle' || status === 'loading') && schools.length === 0
      }
      loadingAccessibilityLabel="Loading nearby schools"
      // A missing permission is not a failure, so it uses the empty slot's
      // prompt instead of the rail's error banner.
      error={needsLocation ? '' : error}
      onRetry={onRetry}
      retryAccessibilityLabel="Retry loading nearby schools"
      isEmpty={schools.length === 0}
      empty={
        needsLocation ? (
          <LocationPrompt
            status={status}
            onEnableLocation={onEnableLocation}
          />
        ) : (
          <EmptyRailCard
            title="No schools nearby"
            message="We couldn’t find a campus close to you. Try searching by name instead."
          />
        )
      }
    >
      {schools.map((school) => {
        const isSaved = savedSchoolIds.includes(school.id);

        return (
          <HomeRailCard
            key={school.id}
            imageUrl={school.spotImageUrl}
            title={school.name}
            subtitle={`${school.city}, ${school.state}`}
            meta={
              <View>
                {origin ? (
                  <View className="flex-row items-center">
                    <Feather
                      name="navigation"
                      size={12}
                      color={colors.muted}
                    />
                    <Text className="ml-1 font-outfit-medium text-sm text-muted">
                      {formatDistanceFromMeters(
                        schoolDistanceMeters(origin, school)
                      )}
                    </Text>
                  </View>
                ) : null}
                <SchoolSpotCount count={school.numSpots} type={school.type} />
              </View>
            }
            onPress={() => onPress(school)}
            accessibilityLabel={`Open ${school.name} campus map`}
            accessory={
              <FeedbackPressable
                haptic="selection"
                onPress={() => onToggleSave(school)}
                className={`h-9 w-9 items-center justify-center rounded-full ${
                  isSaved ? 'bg-accent' : 'bg-white'
                }`}
                accessibilityRole="button"
                accessibilityLabel={`${isSaved ? 'Remove' : 'Add'} ${school.name} ${isSaved ? 'from' : 'to'} saved schools`}
                accessibilityState={{ selected: isSaved }}
              >
                <Ionicons
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={16}
                  color={isSaved ? colors.brand : colors.ink}
                />
              </FeedbackPressable>
            }
          />
        );
      })}
    </HomeFeedRail>
  );
}
