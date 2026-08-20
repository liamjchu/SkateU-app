import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from '../components/FeedbackPressable';
import { StickerStripe } from '../components/sticker';

export default function AgeRestrictedScreen() {
  const router = useRouter();
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
            Age restriction
          </Text>
        </View>
        <StickerStripe />
      </View>

      <View
        className="w-full max-w-[640px] flex-1 self-center px-6 pt-8"
        style={{ paddingBottom: Math.max(insets.bottom, 24) + 16 }}
      >
        <Text className="font-outfit-black text-2xl leading-8 text-ink">
          SkateU is for people 13 and older
        </Text>
        <Text className="mt-2 font-outfit-medium text-base leading-6 text-muted">
          We can’t create an account for you. You can still browse SkateU
          without an account.
        </Text>

        <FeedbackPressable
          haptic="light"
          onPress={() => router.replace('/')}
          className="mt-8 min-h-14 items-center justify-center rounded-2xl bg-accent px-5 py-4"
          accessibilityRole="button"
          accessibilityLabel="Back to SkateU"
        >
          <Text className="text-center font-outfit-bold text-lg text-brand">
            Back to SkateU
          </Text>
        </FeedbackPressable>
      </View>
    </View>
  );
}
