import { Feather, Ionicons } from '@expo/vector-icons';
import { Image, Text, View } from 'react-native';
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

const MUTED_GREEN = '#52645F';

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
      <Feather name="map-pin" size={12} color={MUTED_GREEN} />
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
    <View className="mb-3 flex-row items-center rounded-3xl bg-surface-tinted p-3">
      <FeedbackPressable
        haptic="light"
        onPress={() => onPress(school)}
        className="min-h-[72px] min-w-0 flex-1 flex-row items-center"
        accessibilityRole="button"
        accessibilityLabel={`Open ${school.name} campus map`}
        accessibilityHint={`${formatSpotCount(school.numSpots)} skate spots at this school`}
      >
        {school.spotImageUrl ? (
          <Image
            source={{ uri: school.spotImageUrl }}
            className="h-[72px] w-[72px] rounded-2xl bg-surface-tinted"
            resizeMode="cover"
            accessibilityLabel={`Spot photo at ${school.name}`}
          />
        ) : (
          <View className="h-[72px] w-[72px] items-center justify-center rounded-2xl bg-surface-tinted">
            <Feather name="map-pin" size={24} color="#52645F" />
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
            className="mt-0.5 font-outfit-medium text-sm text-muted"
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
        className="ml-1 h-11 w-11 items-center justify-center rounded-2xl bg-surface-soft"
        accessibilityRole="button"
        accessibilityLabel={`${isSaved ? 'Remove' : 'Add'} ${school.name} ${isSaved ? 'from' : 'to'} saved schools`}
        accessibilityState={{ selected: isSaved }}
      >
        <Ionicons
          name={isSaved ? 'bookmark' : 'bookmark-outline'}
          size={18}
          color="#1B3B36"
        />
      </FeedbackPressable>
    </View>
  );
}
