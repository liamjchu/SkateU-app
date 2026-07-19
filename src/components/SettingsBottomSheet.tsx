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
      style={styles.modalRoot}
      accessibilityViewIsModal
      accessibilityLabel="Settings"
    >
      <Pressable
        style={styles.backdrop}
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
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
            sheetAnimatedStyle,
          ]}
        >
          <GestureDetector gesture={sheetPanGesture}>
            <View>
              <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-slate-300" />
          <Text
            accessibilityRole="header"
            nativeID="settings-sheet-title"
            className="font-outfit-bold text-xl text-[#1B3B36]"
          >
            Settings
          </Text>
            </View>
          </GestureDetector>

          <View className="mt-5 gap-3">
            <Pressable
              onPress={onChangeUsername}
              className="min-h-12 w-full items-center justify-center rounded-2xl border border-[#21473f] py-4"
              accessibilityLabel="Change username"
              accessibilityRole="button"
              accessibilityHint="Opens the username editor"
            >
              <Text className="font-outfit-bold text-lg text-[#21473f]">
                Change username
              </Text>
            </Pressable>

            <Pressable
              onPress={onChangePassword}
              className="min-h-12 w-full items-center justify-center rounded-2xl border border-[#21473f] py-4"
              accessibilityLabel="Change password"
              accessibilityRole="button"
              accessibilityHint="Opens the password editor"
            >
              <Text className="font-outfit-bold text-lg text-[#21473f]">
                Change password
              </Text>
            </Pressable>

            <Pressable
              onPress={onLogout}
              disabled={loggingOut}
              className={`min-h-12 w-full items-center justify-center rounded-2xl py-4 ${
                loggingOut ? 'bg-[#21473f]/60' : 'bg-[#21473f]'
              }`}
              accessibilityLabel={loggingOut ? 'Logging out' : 'Log out'}
              accessibilityRole="button"
              accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
            >
              <Text className="font-outfit-bold text-lg text-white">
                {loggingOut ? 'Logging out...' : 'Log out'}
              </Text>
            </Pressable>
            <Pressable
              onPress={onDeleteAccount}
              disabled={deleteAccountDisabled}
              className={`min-h-12 w-full items-center justify-center rounded-2xl py-4 ${
                deleteAccountDisabled ? 'bg-[#F3B7B2]/60' : 'bg-[#F3B7B2]'
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
              <Text className="font-outfit-bold text-lg text-[#B45F58]">
                {deleteAccountDisabled ? 'Sending code...' : 'Delete account'}
              </Text>
            </Pressable>

            <FeedbackPressable
              onPress={onClose}
              haptic="light"
              className="min-h-12 w-full items-center justify-center rounded-2xl border border-[#21473f] py-4"
              accessibilityLabel="Cancel"
              accessibilityRole="button"
              accessibilityHint="Closes the settings panel"
            >
              <Text className="font-outfit-bold text-lg text-[#21473f]">
                Cancel
              </Text>
            </FeedbackPressable>
          </View>
        </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    elevation: 100,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 16,
  },
});
