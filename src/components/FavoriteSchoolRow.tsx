import { Feather, Octicons } from '@expo/vector-icons';
import { Alert, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { formatSpotCount } from '../lib/formatSpotCount';
import type { School } from '../types/school';
import FeedbackPressable from './FeedbackPressable';

type FavoriteSchoolRowProps = {
  school: School;
  isSelected: boolean;
  onRemove: (school: School) => void;
  onSelect: (school: School) => void;
};

const SWIPE_ACTION_RATIO = 0.32;

export default function FavoriteSchoolRow({
  school,
  isSelected,
  onRemove,
  onSelect,
}: FavoriteSchoolRowProps) {
  const rowWidth = useSharedValue(1);
  const translateX = useSharedValue(0);

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const resetSwipe = () => {
    translateX.value = withTiming(0, { duration: 160 });
  };

  const confirmRemove = () => {
    Alert.alert(
      'Remove favorite school?',
      `Remove ${school.name} from your favorites?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: resetSwipe },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemove(school),
        },
      ],
      {
        cancelable: true,
        onDismiss: resetSwipe,
      }
    );
  };

  const handleRemove = () => {
    confirmRemove();
  };

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      const maxSwipeDistance = rowWidth.value * SWIPE_ACTION_RATIO;
      translateX.value = Math.max(
        Math.min(event.translationX, 0),
        -maxSwipeDistance
      );
    })
    .onEnd((event) => {
      const maxSwipeDistance = rowWidth.value * SWIPE_ACTION_RATIO;
      const shouldRemove = event.translationX <= -maxSwipeDistance;

      if (shouldRemove) {
        translateX.value = withTiming(-maxSwipeDistance, { duration: 160 });
        runOnJS(confirmRemove)();
        return;
      }

      translateX.value = withTiming(0, { duration: 160 });
    });

  return (
    <View
      className={`relative mb-3 overflow-hidden rounded-3xl border bg-surface ${
        isSelected ? 'border-brand' : 'border-transparent'
      }`}
    >
      <View
        pointerEvents="none"
        className="absolute inset-y-1 right-1 items-center justify-center rounded-3xl bg-errorSurface"
        style={{ width: `${SWIPE_ACTION_RATIO * 100}%` }}
      >
        <Feather name="trash-2" size={18} color="#7F302C" />
        <Text className="mt-1 font-outfit-bold text-xs text-errorText">Remove</Text>
      </View>

      <GestureDetector gesture={swipeGesture}>
        <Animated.View
          onLayout={(event) => {
            rowWidth.value = event.nativeEvent.layout.width;
          }}
          style={rowAnimatedStyle}
        >
          <View className="flex-row items-center rounded-3xl border-2 border-white bg-surface p-2">
            <FeedbackPressable
              onPress={handleRemove}
              className="h-12 w-12 items-center justify-center rounded-2xl bg-surface-soft"
              accessibilityLabel={`Remove ${school.name} from favorites`}
              accessibilityHint="Opens a confirmation before removing this school"
              accessibilityRole="button"
            >
              <Octicons name="star-fill" size={20} color="#1B3B36" />
            </FeedbackPressable>

            <FeedbackPressable
              haptic="light"
              onPress={() => onSelect(school)}
              className="ml-2 min-h-12 min-w-0 flex-1 flex-row items-center justify-between rounded-2xl px-2"
              accessibilityRole="button"
              accessibilityLabel={`Select ${school.name}`}
              accessibilityHint="Selects this school for the campus map button"
              accessibilityState={{ selected: isSelected }}
            >
              <View className="min-w-0 flex-1 pr-2">
                <Text className="font-outfit-bold text-lg text-ink">
                  {school.name}
                </Text>
                <Text className="mt-0.5 font-outfit-medium text-sm text-muted">
                  {school.city}, {school.state}
                </Text>
              </View>

              <View className="w-20 shrink-0 flex-row items-center justify-end rounded-xl px-2 py-1.5">
                <Feather name="map-pin" size={12} color="#475569" />
                <Text className="ml-1.5 font-outfit-bold text-base text-ink">
                  {formatSpotCount(school.numSpots)}
                </Text>
              </View>
            </FeedbackPressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
