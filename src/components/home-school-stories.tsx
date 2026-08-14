import { Image, ScrollView, Text, View } from 'react-native';
import type { School } from '../types/school';
import FeedbackPressable from './FeedbackPressable';

type HomeSchoolStoriesProps = {
  schools: School[];
  onPress: (school: School) => void;
};

export default function HomeSchoolStories({
  schools,
  onPress,
}: HomeSchoolStoriesProps) {
  if (schools.length === 0) {
    return null;
  }

  return (
    <View>
      <View className="mb-3">
        <Text className="font-outfit-bold text-base text-ink">Your schools</Text>
        <Text className="mt-0.5 font-outfit-medium text-sm text-muted">
          Jump back to a campus you saved
        </Text>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        className="-mx-6"
        contentContainerClassName="gap-4 px-6"
      >
        {schools.map((school) => (
          <FeedbackPressable
            key={school.id}
            haptic="light"
            onPress={() => onPress(school)}
            className="w-[72px] items-center"
            accessibilityRole="button"
            accessibilityLabel={`Open ${school.name} campus map`}
          >
            {school.spotImageUrl ? (
              <Image
                source={{ uri: school.spotImageUrl }}
                className="h-16 w-16 rounded-full bg-surface-soft"
                resizeMode="cover"
                accessible={false}
              />
            ) : (
              <View className="h-16 w-16 items-center justify-center rounded-full bg-surface-soft">
                <Text className="font-outfit-bold text-lg text-brand">
                  {school.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text
              numberOfLines={1}
              className="mt-1.5 text-center font-outfit-semibold text-sm text-ink"
            >
              {school.name}
            </Text>
          </FeedbackPressable>
        ))}
      </ScrollView>
    </View>
  );
}
