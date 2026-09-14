import { useGuardedRouter } from '../lib/navigationGuard';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useFontScale } from '../hooks/useFontScale';
import FeedbackPressable from './FeedbackPressable';

type LoginRequiredModalProps = {
  visible: boolean;
  onCancel: () => void;
  title?: string;
  message?: string;
};

export default function LoginRequiredModal({
  visible,
  onCancel,
  title = 'Sign up to like and add spots',
  message = 'You can still browse campuses, view spots, and read comments. Sign up to like spots, add your own, or report content. Already have an account? You can log in from the next screen.',
}: LoginRequiredModalProps) {
  const router = useGuardedRouter();
  const { isExtraLarge } = useFontScale();

  const handleLoginPress = () => {
    onCancel();
    router.push('/signup');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View
        className="flex-1"
        accessibilityViewIsModal
        accessibilityLabel="Sign up required"
        style={{ backgroundColor: 'rgba(42, 34, 36, 0.32)' }}
      >
        <Pressable
          onPress={onCancel}
          className="absolute inset-0"
          accessibilityRole="button"
          accessibilityLabel="Dismiss sign up prompt"
        />

        <View
          pointerEvents="box-none"
          className="flex-1 items-center justify-center px-6"
        >
          <View className="w-full max-w-[480px] rounded-2xl bg-field p-6">
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              className="max-h-[70vh]"
            >
            <Text className="text-2xl text-ink font-outfit-black">
              {title}
            </Text>
            <Text className="mt-3 text-base text-muted font-outfit-medium">
              {message}
            </Text>

            <View className={`mt-6 gap-3 ${isExtraLarge ? '' : 'flex-row'}`}>
              <FeedbackPressable
                onPress={onCancel}
                className="min-h-12 flex-1 items-center justify-center rounded-xl bg-surface-soft py-4"
                accessibilityLabel="Cancel sign up prompt"
                accessibilityRole="button"
              >
                <Text className="text-center text-base text-ink font-outfit-bold">
                  Not now
                </Text>
              </FeedbackPressable>
              <FeedbackPressable
                haptic="light"
                onPress={handleLoginPress}
                className="min-h-12 flex-1 items-center justify-center rounded-xl bg-accent py-4"
                accessibilityLabel="Go to sign up"
                accessibilityRole="button"
              >
                <Text className="text-center text-base text-brand font-outfit-bold">
                  Sign up
                </Text>
              </FeedbackPressable>
            </View>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}
