import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from './FeedbackPressable';
import { StickerStripe } from './sticker';

type AgeGatePromptProps = {
  onYes: () => void;
  onNo: () => void;
  yesDisabled?: boolean;
  noDisabled?: boolean;
  footer?: ReactNode;
};

export default function AgeGatePrompt({
  onYes,
  onNo,
  yesDisabled = false,
  noDisabled = false,
  footer,
}: AgeGatePromptProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-surface">
      <View className="bg-brand">
        <View
          className="px-6 pb-4"
          style={{
            paddingTop: insets.top + 16,
          }}
        >
          <Text
            className="font-outfit-bold text-2xl text-white"
            numberOfLines={1}
          >
            One question
          </Text>
        </View>
        <StickerStripe />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 24) + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-[640px] self-center px-6 pt-8">
          <Text className="font-outfit-black text-2xl leading-8 text-ink">
            Are you 13 or older?
          </Text>
          <Text className="mt-2 font-outfit-medium text-base leading-6 text-muted">
            SkateU accounts are for people 13 and older. We do not ask for your
            date of birth.
          </Text>

          <FeedbackPressable
            haptic="light"
            onPress={onYes}
            disabled={yesDisabled}
            className={`mt-8 min-h-14 items-center justify-center rounded-2xl px-5 py-4 ${
              yesDisabled ? 'bg-actionDisabled' : 'bg-accent'
            }`}
            accessibilityRole="button"
            accessibilityLabel="Yes, I am 13 or older"
            accessibilityState={{ disabled: yesDisabled }}
          >
            <Text
              className={`text-center font-outfit-bold text-lg ${
                yesDisabled ? 'text-muted' : 'text-brand'
              }`}
            >
              Yes, I am 13 or older
            </Text>
          </FeedbackPressable>

          <FeedbackPressable
            onPress={onNo}
            disabled={noDisabled}
            className="mt-3 min-h-14 items-center justify-center rounded-2xl bg-field px-5 py-4"
            accessibilityRole="button"
            accessibilityLabel="No, I am under 13"
            accessibilityState={{ disabled: noDisabled }}
          >
            <Text className="text-center font-outfit-semibold text-base text-ink">
              No, I am under 13
            </Text>
          </FeedbackPressable>

          {footer}
        </View>
      </ScrollView>
    </View>
  );
}
