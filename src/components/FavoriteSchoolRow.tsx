import { Feather, Octicons } from '@expo/vector-icons';
import type { GestureResponderEvent } from 'react-native';
import { Alert, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import type { School } from '../types/school';
import FeedbackPressable from './FeedbackPressable';

type FavoriteSchoolRowProps = {
  school: School;
  isRemoving: boolean;
  onRemove: (school: School) => void;
  onSelect: (school: School) => void;
};

const SWIPE_ACTION_RATIO = 0.32;

export default function FavoriteSchoolRow({
  school,
  isRemoving,
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

  const handleRemove = (event?: GestureResponderEvent) => {
    event?.stopPropagation();
    confirmRemove();
  };

  const swipeGesture = Gesture.Pan()
    .enabled(!isRemoving)
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
    <FeedbackPressable
      disablePressOpacity
      haptic="light"
      disabled={isRemoving}
      onPress={() => onSelect(school)}
      className="relative mb-3 overflow-hidden rounded-3xl bg-white"
      accessibilityRole="button"
      accessibilityLabel={`Open ${school.name}`}
      accessibilityHint="Opens the campus map"
    >
      <View
        pointerEvents="none"
        className="absolute inset-y-1 right-1 w-[40%] items-center justify-center rounded-3xl bg-[#FBE9E7]"
      >
        <Feather name="trash-2" size={18} color="#7F302C" />
        <Text className="mt-1 font-outfit-bold text-xs text-[#7F302C]">Remove</Text>
      </View>

      <GestureDetector gesture={swipeGesture}>
        <Animated.View
          onLayout={(event) => {
            rowWidth.value = event.nativeEvent.layout.width;
          }}
          style={rowAnimatedStyle}
        >
          <View className="flex-row items-center justify-between rounded-3xl border-2 border-white bg-white p-2">
            <View className="min-w-0 flex-1 flex-row items-center pr-2">
              <FeedbackPressable
                disabled={isRemoving}
                onPress={handleRemove}
                className="h-12 w-12 items-center justify-center rounded-2xl bg-[#F0F5F4]"
                accessibilityLabel={`Remove ${school.name} from favorites`}
                accessibilityHint="Opens a confirmation before removing this school"
                accessibilityRole="button"
              >
                <Octicons name="star-fill" size={20} color="#1B3B36" />
              </FeedbackPressable>

              <View className="ml-4 min-w-0 flex-1">
                <Text
                  className="text-lg text-[#1B3B36]"
                  style={{ fontFamily: 'Outfit_700Bold' }}
                >
                  {school.name}
                </Text>
                <Text
                  className="mt-0.5 text-sm text-slate-400"
                  style={{ fontFamily: 'Outfit_500Medium' }}
                >
                  {school.city}, {school.state}
                </Text>
              </View>
            </View>

            <View className="w-20 shrink-0 flex-row items-center justify-center space-x-1.5 rounded-xl bg-white/50 px-3 py-1.5">
              <Feather
                name="map-pin"
                size={11}
                color="#475569"
                className="mr-[3px]"
              />
              <Text
                className="text-base text-[#1B3B36]"
                style={{ fontFamily: 'Outfit_700Bold' }}
              >
                {school.numSpots}
              </Text>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </FeedbackPressable>
  );
}
