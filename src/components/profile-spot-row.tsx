import { Feather, Octicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { colors } from '../constants/colors';
import type { Spot } from '../types/spot';
import CachedRemoteImage from './CachedRemoteImage';
import ExpandableText from './expandable-text';
import FeedbackPressable from './FeedbackPressable';

type ProfileSpotRowProps = {
  spot: Spot;
  onPress: () => void;
  trailing?: ReactNode;
  statusHint?: string;
  busy?: boolean;
};

export default function ProfileSpotRow({
  spot,
  onPress,
  trailing,
  statusHint,
  busy = false,
}: ProfileSpotRowProps) {
  const place = `${spot.schoolName || 'Campus map'}${
    spot.city || spot.state
      ? ` · ${spot.city}${spot.city && spot.state ? ', ' : ''}${spot.state}`
      : ''
  }`;

  return (
    <View
      className="mb-4 flex-row items-center rounded-2xl bg-field p-4"
      accessibilityState={busy ? { busy: true } : undefined}
    >
      <FeedbackPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${spot.name} on the ${spot.schoolName || 'campus'} map`}
        accessibilityHint="Opens the campus map and selects this spot"
      >
        {spot.imageUris.length > 0 ? (
          <CachedRemoteImage
            uri={spot.imageUris[0]}
            className="h-16 w-16 rounded-xl"
            accessible={false}
          />
        ) : (
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            className="h-16 w-16 items-center justify-center rounded-xl bg-surface-soft"
          >
            <Feather name="image" size={20} color={colors.muted} />
          </View>
        )}
      </FeedbackPressable>

      <View className="ml-3 min-w-0 flex-1">
        <ExpandableText
          collapsedLines={1}
          className="font-outfit-bold text-base text-ink"
          onPress={onPress}
          accessibilityLabel={`Open ${spot.name} on the ${spot.schoolName || 'campus'} map`}
          accessibilityHint="Opens the campus map and selects this spot"
        >
          {spot.name}
        </ExpandableText>
        <View className="mt-0.5 flex-row items-center">
          <Feather name="map-pin" size={11} color={colors.muted} />
          <View className="ml-1 min-w-0 flex-1">
            <ExpandableText
              collapsedLines={1}
              className="font-outfit-semibold text-xs text-muted-soft"
              onPress={onPress}
              accessibilityLabel={`Open ${spot.name} on the ${spot.schoolName || 'campus'} map`}
              accessibilityHint="Opens the campus map and selects this spot"
            >
              {place}
            </ExpandableText>
          </View>
        </View>
        {statusHint ? (
          <Text
            className="mt-0.5 font-outfit-medium text-sm text-muted"
            accessibilityLiveRegion={busy ? 'polite' : undefined}
          >
            {statusHint}
          </Text>
        ) : spot.description.trim().length > 0 ? (
          <ExpandableText
            collapsedLines={2}
            className="font-outfit-medium mt-0.5 text-sm text-muted"
            onPress={onPress}
            accessibilityLabel={`Open ${spot.name} on the ${spot.schoolName || 'campus'} map`}
            accessibilityHint="Opens the campus map and selects this spot"
          >
            {spot.description.trim()}
          </ExpandableText>
        ) : null}
        <View className="mt-1 flex-row items-center">
          <Octicons name="heart-fill" size={12} color={colors.accent} />
          <Text className="font-outfit-semibold ml-1 text-xs text-muted">
            {spot.likeCount ?? 0}
          </Text>
        </View>
      </View>

      {trailing}
    </View>
  );
}
