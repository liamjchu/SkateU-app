import { Text, View } from 'react-native';
import FeedbackPressable from './FeedbackPressable';

type StaleCacheBannerProps = {
  message: string;
  onRetry: () => void;
  retryAccessibilityLabel: string;
};

export default function StaleCacheBanner({
  message,
  onRetry,
  retryAccessibilityLabel,
}: StaleCacheBannerProps) {
  return (
    <View className="flex-row items-center rounded-2xl border border-errorBorder bg-errorSurface px-3 py-2.5">
      <Text
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className="flex-1 pr-2 font-outfit-medium text-sm text-errorText"
      >
        {message}
      </Text>
      <FeedbackPressable
        onPress={onRetry}
        className="rounded-xl bg-accent px-3 py-1.5"
        accessibilityRole="button"
        accessibilityLabel={retryAccessibilityLabel}
      >
        <Text className="font-outfit-bold text-sm text-brand">Retry</Text>
      </FeedbackPressable>
    </View>
  );
}
