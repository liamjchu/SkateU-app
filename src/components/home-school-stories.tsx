import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import type { School } from '../types/school';
import FeedbackPressable from './FeedbackPressable';
import HomeRailCard from './home-rail-card';
import { SchoolSpotCount } from './PopularSchoolCard';

type HomeSchoolStoriesProps = {
  schools: School[];
  onPress: (school: School) => void;
  onToggleSave: (school: School) => void;
  showHeader?: boolean;
};

export default function HomeSchoolStories({
  schools,
  onPress,
  onToggleSave,
  showHeader = true,
}: HomeSchoolStoriesProps) {
  if (schools.length === 0) {
    return null;
  }

  return (
    <View>
      {showHeader ? (
        <View className="mb-4">
          <Text className="font-outfit-bold text-base text-ink">Your schools</Text>
          <Text className="mt-0.5 font-outfit-medium text-sm text-muted">
            Jump back to a campus you saved
          </Text>
        </View>
      ) : null}
      <ScrollView
        horizontal
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        className="-mx-6"
        contentContainerClassName="items-center gap-3 px-6"
      >
        {schools.map((school) => (
          <HomeRailCard
            key={school.id}
            imageUrl={school.spotImageUrl}
            title={school.name}
            subtitle={`${school.city}, ${school.state}`}
            meta={
              <SchoolSpotCount count={school.numSpots} type={school.type} />
            }
            onPress={() => onPress(school)}
            accessibilityLabel={`Open ${school.name} campus map`}
            accessory={
              <FeedbackPressable
                haptic="selection"
                onPress={() => onToggleSave(school)}
                className="h-9 w-9 items-center justify-center rounded-full bg-accent"
                accessibilityRole="button"
                accessibilityLabel={`Remove ${school.name} from saved schools`}
                accessibilityState={{ selected: true }}
              >
                <Ionicons name="bookmark" size={16} color={colors.brand} />
              </FeedbackPressable>
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}
