import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { getClientStorage } from '../lib/clientStorage';
import { colors } from '../constants/colors';
import FeedbackPressable from './FeedbackPressable';

type NoticeBannerProps = {
  // Stable id used to remember a dismiss. Reuse this component later with
  // a new id for things like a "what's new" or promo banner.
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  // Collapses the banner without dismissing it (e.g. while search is open).
  collapsed?: boolean;
};

function dismissedStorageKey(id: string) {
  return `@skateu:notice-dismissed:${id}`;
}

const COLLAPSE_TIMING = {
  duration: 220,
  easing: Easing.out(Easing.cubic),
};

export default function NoticeBanner({
  id,
  icon,
  title,
  message,
  actionLabel,
  onAction,
  collapsed = false,
}: NoticeBannerProps) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const height = useSharedValue(0);
  const opacity = useSharedValue(0);

  const shouldShow = hasHydrated && !isDismissed && !collapsed;

  useEffect(() => {
    let cancelled = false;

    const restoreDismissedState = async () => {
      try {
        const dismissed = await getClientStorage().getItem(
          dismissedStorageKey(id)
        );

        if (!cancelled) {
          setIsDismissed(dismissed === '1');
          setHasHydrated(true);
        }
      } catch {
        if (!cancelled) {
          setHasHydrated(true);
        }
      }
    };

    void restoreDismissedState();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!shouldShow || contentHeight <= 0) {
      height.value = withTiming(0, COLLAPSE_TIMING);
      opacity.value = withTiming(0, { duration: 160 });
      return;
    }

    height.value = withTiming(contentHeight, COLLAPSE_TIMING);
    opacity.value = withTiming(1, { duration: 180 });
  }, [contentHeight, height, opacity, shouldShow]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
  }));

  const handleDismiss = () => {
    setIsDismissed(true);
    void getClientStorage()
      .setItem(dismissedStorageKey(id), '1')
      .catch(() => undefined);
  };

  return (
    <Animated.View
      pointerEvents={shouldShow ? 'auto' : 'none'}
      accessibilityElementsHidden={!shouldShow}
      importantForAccessibility={shouldShow ? 'auto' : 'no-hide-descendants'}
      style={[{ overflow: 'hidden' }, animatedStyle]}
    >
      <View
        onLayout={({ nativeEvent }) => {
          setContentHeight(nativeEvent.layout.height);
        }}
        className="pb-4"
      >
        <View
          className="flex-row items-start rounded-2xl bg-field p-3.5"
          accessibilityRole="summary"
          accessibilityLabel={`${title}. ${message}`}
        >
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent">
            <Ionicons name={icon} size={18} color={colors.brand} />
          </View>

          <View className="ml-3 min-w-0 flex-1">
            <Text className="font-outfit-bold text-base text-ink">{title}</Text>
            <Text className="mt-0.5 font-outfit-medium text-sm leading-5 text-muted">
              {message}
            </Text>

            {actionLabel && onAction ? (
              <FeedbackPressable
                haptic="light"
                onPress={onAction}
                className="mt-3 self-start rounded-xl bg-accent px-4 py-2"
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
              >
                <Text className="font-outfit-bold text-sm text-brand">
                  {actionLabel}
                </Text>
              </FeedbackPressable>
            ) : null}
          </View>

          <FeedbackPressable
            haptic="selection"
            onPress={handleDismiss}
            className="-mr-1 -mt-1 h-8 w-8 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Dismiss notice"
          >
            <Ionicons name="close" size={16} color={colors.muted} />
          </FeedbackPressable>
        </View>
      </View>
    </Animated.View>
  );
}
