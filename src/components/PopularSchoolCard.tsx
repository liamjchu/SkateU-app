import { Feather, Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import CachedRemoteImage from './CachedRemoteImage';
import { colors } from '../constants/colors';
import { formatSpotCount } from '../lib/formatSpotCount';
import type { School, SchoolType } from '../types/school';
import FeedbackPressable from './FeedbackPressable';

type PopularSchoolCardProps = {
  school: School;
  isSaved: boolean;
  onPress: (school: School) => void;
  onToggleSave: (school: School) => void;
};

const SCHOOL_TYPE_LABELS: Record<SchoolType, string> = {
  k12_public: 'K-12',
  k12_private: 'K-12',
  higher_ed: 'College',
};

export function schoolTypeLabel(type?: SchoolType): string | undefined {
  return type ? SCHOOL_TYPE_LABELS[type] : undefined;
}

export function SchoolSpotCount({
  count,
  type,
}: {
  count: number;
  type?: SchoolType;
}) {
  const typeLabel = schoolTypeLabel(type);

  return (
    <View className="flex-row items-center">
      <Feather name="map-pin" size={12} color={colors.muted} />
      <Text className="ml-1 font-outfit-medium text-sm text-muted">
        {typeLabel
          ? `${formatSpotCount(count)} · ${typeLabel}`
          : formatSpotCount(count)}
      </Text>
    </View>
  );
}

export default function PopularSchoolCard({
  school,
  isSaved,
  onPress,
  onToggleSave,
}: PopularSchoolCardProps) {
  return (
    <View className="mb-4 overflow-hidden rounded-2xl bg-field">
        <View className="flex-row items-center p-4">
          <FeedbackPressable
            haptic="light"
            onPress={() => onPress(school)}
            className="min-h-[72px] min-w-0 flex-1 flex-row items-center"
            accessibilityRole="button"
            accessibilityLabel={`Open ${school.name} campus map`}
            accessibilityHint={`${formatSpotCount(school.numSpots)} skate spots at this school`}
          >
            {school.spotImageUrl ? (
              <CachedRemoteImage
                uri={school.spotImageUrl}
                className="h-[72px] w-[72px] rounded-xl bg-surface-soft"
                style={{ height: 72, width: 72 }}
                accessible={false}
              />
            ) : (
              <View className="h-[72px] w-[72px] items-center justify-center rounded-xl bg-accent">
                <Feather name="map-pin" size={24} color={colors.brand} />
              </View>
            )}

            <View className="ml-3 min-w-0 flex-1">
              <Text
                numberOfLines={1}
                className="font-outfit-bold text-base text-ink"
              >
                {school.name}
              </Text>
              <Text
                numberOfLines={1}
                className="mt-0.5 font-outfit-medium text-sm text-muted-soft"
              >
                {school.city}, {school.state}
              </Text>

              <View className="mt-1.5 flex-row items-center">
                <SchoolSpotCount count={school.numSpots} type={school.type} />
              </View>
            </View>
          </FeedbackPressable>

          <FeedbackPressable
            haptic="selection"
            onPress={() => onToggleSave(school)}
            className={`h-11 w-11 items-center justify-center rounded-xl ${
              isSaved ? 'bg-accent' : 'bg-surface-soft'
            }`}
            accessibilityRole="button"
            accessibilityLabel={`${isSaved ? 'Remove' : 'Add'} ${school.name} ${isSaved ? 'from' : 'to'} saved schools`}
            accessibilityState={{ selected: isSaved }}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isSaved ? colors.brand : colors.ink}
            />
          </FeedbackPressable>
        </View>
    </View>
  );
}
