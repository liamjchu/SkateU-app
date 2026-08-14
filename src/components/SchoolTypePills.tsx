import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text } from 'react-native';
import type { SchoolTypeFilter } from '../types/school';
import FeedbackPressable from './FeedbackPressable';

type SchoolTypePillsProps = {
  selected: SchoolTypeFilter;
  onSelect: (filter: SchoolTypeFilter) => void;
};

type FilterOption = {
  key: SchoolTypeFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const FILTER_OPTIONS: FilterOption[] = [
  { key: 'all', label: 'All', icon: 'grid-outline' },
  { key: 'k12', label: 'K-12', icon: 'book-outline' },
  { key: 'college', label: 'College', icon: 'school-outline' },
  { key: 'saved', label: 'Saved', icon: 'bookmark-outline' },
];

// Maps a pill filter to the `type` query param for /api/schools.
// Returns null for "all" and "saved" (no type filter applied).
export function getSchoolTypesParam(filter: SchoolTypeFilter): string | null {
  switch (filter) {
    case 'k12':
      return 'k12_public,k12_private';
    case 'college':
      return 'higher_ed';
    default:
      return null;
  }
}

export default function SchoolTypePills({
  selected,
  onSelect,
}: SchoolTypePillsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-2 py-1"
    >
      {FILTER_OPTIONS.map((option) => {
        const isSelected = option.key === selected;

        return (
          <FeedbackPressable
            key={option.key}
            haptic="selection"
            onPress={() => onSelect(option.key)}
            className={`h-10 flex-row items-center rounded-full border px-4 ${
              isSelected
                ? 'border-brand bg-brand'
                : 'border-border-soft bg-surface-soft'
            }`}
            accessibilityRole="button"
            accessibilityLabel={
              option.key === 'saved'
                ? 'Show saved schools'
                : `Filter schools by ${option.label}`
            }
            accessibilityState={{ selected: isSelected }}
          >
            <Ionicons
              name={
                isSelected && option.key === 'saved'
                  ? 'bookmark'
                  : option.icon
              }
              size={15}
              color={isSelected ? '#FFFFFF' : '#52645F'}
            />
            <Text
              className={`ml-1.5 font-outfit-semibold text-sm ${
                isSelected ? 'text-white' : 'text-muted'
              }`}
            >
              {option.label}
            </Text>
          </FeedbackPressable>
        );
      })}
    </ScrollView>
  );
}
