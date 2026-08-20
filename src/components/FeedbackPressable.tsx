import { forwardRef, useEffect, useState } from 'react';
import {
    AccessibilityInfo,
    Pressable,
    type PressableProps,
    type View
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { triggerHaptic, type HapticFeedback } from '../lib/haptics';

type FeedbackPressableProps = PressableProps & {
  disablePressOpacity?: boolean;
  disablePressScale?: boolean;
  haptic?: HapticFeedback;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const FeedbackPressable = forwardRef<View, FeedbackPressableProps>(
  function FeedbackPressable({
  disabled,
  disablePressOpacity = false,
  disablePressScale = false,
  haptic,
  onPress,
  onPressIn,
  onPressOut,
  style,
  ...props
}: FeedbackPressableProps, ref) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

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
      ref={ref}
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
          if (!disablePressScale) {
            scale.value = withTiming(0.98, { duration: 100 });
          }
          if (!disablePressOpacity) {
            opacity.value = withTiming(0.88, { duration: 100 });
          }
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reduceMotion) {
          if (!disablePressScale) {
            scale.value = withTiming(1, { duration: 150 });
          }
          if (!disablePressOpacity) {
            opacity.value = withTiming(1, { duration: 150 });
          }
        }
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    />
  );
  }
);

export default FeedbackPressable;
