import { useEffect, useState } from 'react';
import {
    AccessibilityInfo,
    Pressable,
    type PressableProps,
} from 'react-native';
import Animated, {
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { triggerHaptic, type HapticFeedback } from '../lib/haptics';

type FeedbackPressableProps = PressableProps & {
  disablePressOpacity?: boolean;
  haptic?: HapticFeedback;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function FeedbackPressable({
  disabled,
  disablePressOpacity = false,
  haptic,
  onPress,
  onPressIn,
  onPressOut,
  style,
  ...props
}: FeedbackPressableProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => subscription.remove();
  }, []);

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPress={(event) => {
        onPress?.(event);
        if (!disabled && haptic) {
          triggerHaptic(haptic);
        }
      }}
      onPressIn={(event) => {
        if (!reduceMotion) {
          scale.value = withTiming(0.98, { duration: 100 });
          if (!disablePressOpacity) {
            opacity.value = withTiming(0.88, { duration: 100 });
          }
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reduceMotion) {
          scale.value = withTiming(1, { duration: 150 });
          if (!disablePressOpacity) {
            opacity.value = withTiming(1, { duration: 150 });
          }
        }
        onPressOut?.(event);
      }}
      style={[
        style,
        {
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}
