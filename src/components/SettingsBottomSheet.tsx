import { useEffect, useState } from 'react';
import {
    BackHandler,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    SlideInDown,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from './FeedbackPressable';

type SettingsBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  onChangeUsername: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  deleteAccountDisabled: boolean;
  loggingOut: boolean;
};

export default function SettingsBottomSheet({
  visible,
  onClose,
  onChangeUsername,
  onChangePassword,
  onLogout,
  onDeleteAccount,
  deleteAccountDisabled,
  loggingOut,
}: SettingsBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [rendered, setRendered] = useState(visible);
  const sheetHeight = useSharedValue(0);
  const sheetTranslateY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      sheetTranslateY.value = 0;
      return;
    }

    if (!rendered) {
      return;
    }

    sheetTranslateY.value = withTiming(
      sheetHeight.value || screenHeight,
      { duration: 220, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(setRendered)(false);
        }
      }
    );
  }, [rendered, screenHeight, sheetHeight, sheetTranslateY, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose();
        return true;
      }
    );

    return () => subscription.remove();
  }, [onClose, visible]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const sheetPanGesture = Gesture.Pan()
    .onBegin(() => {
      sheetTranslateY.value = Math.max(sheetTranslateY.value, 0);
    })
    .onUpdate((event) => {
      sheetTranslateY.value = Math.max(event.translationY, 0);
    })
    .onEnd((event) => {
      const dismissThreshold = sheetHeight.value * 0.25;
      const shouldDismiss =
        event.translationY > dismissThreshold || event.velocityY > 800;

      if (shouldDismiss) {
        runOnJS(onClose)();
        return;
      }

      sheetTranslateY.value = withTiming(0, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
    });

  if (!rendered) {
    return null;
  }

  return (
    <View
      className="absolute inset-0 z-[100]"
      accessibilityViewIsModal
      accessibilityLabel="Settings"
    >
      <Pressable
        className="absolute inset-0 z-0 bg-black/35"
        onPress={onClose}
        accessibilityLabel="Close settings"
        accessibilityRole="button"
        accessibilityHint="Dismisses the settings panel"
      />

      <Animated.View
          entering={SlideInDown.duration(240).easing(Easing.out(Easing.cubic))}
          onLayout={(event) => {
            sheetHeight.value = event.nativeEvent.layout.height;
          }}
          className="absolute bottom-0 left-0 right-0 z-10 rounded-t-[28px] bg-white px-5 pt-3"
          style={[
            styles.sheetShadow,
            { paddingBottom: Math.max(insets.bottom, 16) },
            sheetAnimatedStyle,
          ]}
        >
          <GestureDetector gesture={sheetPanGesture}>
            <View>
              <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-slate-300" />
              <View className="min-h-12 flex-row items-center justify-between">
                <Text
                  accessibilityRole="header"
                  nativeID="settings-sheet-title"
                  className="font-outfit-bold text-xl text-ink"
                >
                  Settings
                </Text>
                <FeedbackPressable
                  onPress={onClose}
                  haptic="selection"
                  className="min-h-12 min-w-12 items-center justify-center rounded-full px-2 py-1"
                  accessibilityRole="button"
                  accessibilityLabel="Close settings"
                >
                  <Text className="font-outfit-semibold text-sm text-slate-600">
                    Close
                  </Text>
                </FeedbackPressable>
              </View>
            </View>
          </GestureDetector>

          <View className="mt-4 gap-3 pb-6">
            <FeedbackPressable
              haptic="selection"
              onPress={onChangeUsername}
              className="min-h-12 w-full items-center justify-center rounded-2xl border border-[#21473f] py-4"
              accessibilityLabel="Change username"
              accessibilityRole="button"
              accessibilityHint="Opens the username editor"
            >
              <Text className="font-outfit-bold text-lg text-darkGreen">
                Change username
              </Text>
            </FeedbackPressable>

            <FeedbackPressable
              haptic="selection"
              onPress={onChangePassword}
              className="min-h-12 w-full items-center justify-center rounded-2xl border border-[#21473f] py-4"
              accessibilityLabel="Change password"
              accessibilityRole="button"
              accessibilityHint="Opens the password editor"
            >
              <Text className="font-outfit-bold text-lg text-darkGreen">
                Change password
              </Text>
            </FeedbackPressable>

            <FeedbackPressable
              haptic="light"
              onPress={onLogout}
              disabled={loggingOut}
              className={`min-h-12 w-full items-center justify-center rounded-2xl py-4 ${
                loggingOut ? 'bg-[#60756F]' : 'bg-[#21473f]'
              }`}
              accessibilityLabel={loggingOut ? 'Logging out' : 'Log out'}
              accessibilityRole="button"
              accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
            >
              <Text className="font-outfit-bold text-lg text-white">
                {loggingOut ? 'Logging out...' : 'Log out'}
              </Text>
            </FeedbackPressable>
            <FeedbackPressable
              haptic="warning"
              onPress={onDeleteAccount}
              disabled={deleteAccountDisabled}
              className={`min-h-12 w-full items-center justify-center rounded-2xl py-4 ${
                deleteAccountDisabled ? 'bg-[#60756F]' : 'bg-[#FBE9E7]'
              }`}
              accessibilityLabel={
                deleteAccountDisabled ? 'Sending account deletion code' : 'Delete account'
              }
              accessibilityRole="button"
              accessibilityState={{
                disabled: deleteAccountDisabled,
                busy: deleteAccountDisabled,
              }}
            >
              <Text className={`font-outfit-bold text-lg ${deleteAccountDisabled ? 'text-white' : 'text-errorText'}`}>
                {deleteAccountDisabled ? 'Sending code...' : 'Delete account'}
              </Text>
            </FeedbackPressable>

          </View>
        </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 16,
  },
});
