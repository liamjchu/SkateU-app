import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { useXpFeedbackStore } from '../store/xpFeedbackStore';
import FeedbackPressable from './FeedbackPressable';

const DISMISS_MS = 3200;

export default function XpToastBanner() {
  const insets = useSafeAreaInsets();
  const toast = useXpFeedbackStore((state) => state.toast);
  const rankUp = useXpFeedbackStore((state) => state.rankUp);
  const clearToast = useXpFeedbackStore((state) => state.clearToast);

  useEffect(() => {
    if (!toast || rankUp) {
      return;
    }

    const timeout = setTimeout(() => {
      clearToast();
    }, DISMISS_MS);

    return () => clearTimeout(timeout);
  }, [clearToast, rankUp, toast]);

  if (!toast || rankUp) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 z-[110] px-6"
      style={{ top: insets.top + 12 }}
    >
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        accessibilityLabel={`${toast.title}. ${toast.message}`}
        className="flex-row items-start rounded-2xl border border-border-soft bg-field p-3.5"
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent">
          <Ionicons name="star" size={18} color={colors.brand} />
        </View>
        <View className="ml-3 min-w-0 flex-1">
          <Text className="font-outfit-bold text-base text-ink">{toast.title}</Text>
          <Text className="mt-0.5 font-outfit-medium text-sm leading-5 text-muted">
            {toast.message}
          </Text>
        </View>
        <FeedbackPressable
          haptic="selection"
          onPress={clearToast}
          className="-mr-1 -mt-1 h-8 w-8 items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel="Dismiss XP notice"
        >
          <Ionicons name="close" size={16} color={colors.muted} />
        </FeedbackPressable>
      </View>
    </View>
  );
}
