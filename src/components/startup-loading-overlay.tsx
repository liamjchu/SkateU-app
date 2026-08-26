import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../constants/colors';
import images from '../constants/images';

const TRACK_WIDTH = 180;
const TRACK_HEIGHT = 4;

type StartupLoadingOverlayProps = {
  progress: number;
  logoWidth: number;
  logoHeight: number;
  errorBannerTop: number;
  profileError: string | null;
  profileLoading: boolean;
  onSignOut: () => void;
  onRetryProfile: () => void;
};

export default function StartupLoadingOverlay({
  progress,
  logoWidth,
  logoHeight,
  errorBannerTop,
  profileError,
  profileLoading,
  onSignOut,
  onRetryProfile,
}: StartupLoadingOverlayProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const percent = Math.round(clampedProgress * 100);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: clampedProgress,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clampedProgress, progressAnim]);

  const fillWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRACK_WIDTH],
  });

  return (
    <View
      className="absolute inset-0 z-50 items-center justify-center bg-surface px-8"
      accessibilityRole="progressbar"
      accessibilityLabel="Loading SkateU"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      <Image
        source={images.brandLockupCentered}
        accessibilityLabel="SkateU"
        style={{ width: logoWidth, height: logoHeight }}
        resizeMode="contain"
      />
      <View
        className="mt-8 overflow-hidden rounded-full bg-surface-soft"
        style={styles.track}
      >
        <Animated.View
          className="rounded-full bg-accent"
          style={[styles.fill, { width: fillWidth }]}
        />
      </View>
      {profileError ? (
        <View
          className="absolute left-4 right-4 rounded-2xl bg-field px-4 py-3"
          style={{ top: errorBannerTop }}
        >
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="font-outfit-medium text-base text-ink"
          >
            {profileError}
          </Text>
          <View className="mt-3 flex-row items-center justify-end gap-2">
            <Pressable
              className="rounded-xl px-3 py-2"
              onPress={onSignOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Text className="font-outfit-bold text-sm text-ink">Sign out</Text>
            </Pressable>
            <Pressable
              className="rounded-xl bg-accent px-3 py-2"
              onPress={onRetryProfile}
              disabled={profileLoading}
              accessibilityRole="button"
              accessibilityLabel="Retry loading profile"
              accessibilityState={{ busy: profileLoading }}
            >
              <Text className="font-outfit-bold text-sm text-brand">Retry</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
  },
  fill: {
    height: TRACK_HEIGHT,
    backgroundColor: colors.accent,
  },
});
