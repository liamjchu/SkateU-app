import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from './FeedbackPressable';
import { StickerStripe } from './sticker';

type ScreenHeaderProps = {
  title: string;
  onBack: () => void;
  backAccessibilityLabel?: string;
  backDisabled?: boolean;
  rightAction?: ReactNode;
};

export default function ScreenHeader({
  title,
  onBack,
  backAccessibilityLabel = 'Go back',
  backDisabled = false,
  rightAction,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="bg-brand">
      <View
        className="px-6"
        style={{
          paddingTop: insets.top,
        }}
      >
        <View className="h-20 flex-row items-center">
          <FeedbackPressable
            haptic="light"
            onPress={onBack}
            disabled={backDisabled}
            className="h-12 w-12 items-center justify-center rounded-full"
            accessibilityLabel={backAccessibilityLabel}
            accessibilityRole="button"
            accessibilityState={{ disabled: backDisabled }}
          >
            <Feather name="chevron-left" size={28} color="#FFFFFF" />
          </FeedbackPressable>

          <Text
            accessibilityRole="header"
            className="min-w-0 flex-1 text-center font-outfit-bold text-2xl text-white"
            numberOfLines={1}
          >
            {title}
          </Text>

          {rightAction ?? <View className="h-12 w-12" />}
        </View>
      </View>
      <StickerStripe />
    </View>
  );
}
