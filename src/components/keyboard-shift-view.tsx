import { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { extraKeyboardPadding } from '../lib/keyboardShift';

type KeyboardShiftViewProps = {
  children: ReactNode;
  closedBottomPadding?: number;
  style?: StyleProp<ViewStyle>;
};

export default function KeyboardShiftView({
  children,
  closedBottomPadding = 0,
  style,
}: KeyboardShiftViewProps) {
  const keyboard = useAnimatedKeyboard({
    isStatusBarTranslucentAndroid: true,
    isNavigationBarTranslucentAndroid: true,
  });
  const closedPadding = useSharedValue(closedBottomPadding);
  closedPadding.value = closedBottomPadding;

  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: extraKeyboardPadding(
      keyboard.height.value,
      closedPadding.value
    ),
  }));

  return (
    <Animated.View style={[{ flex: 1 }, style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
