import { useRouter } from 'expo-router';
import { Modal, Pressable, Text, View } from 'react-native';
import FeedbackPressable from './FeedbackPressable';

type LoginRequiredModalProps = {
  visible: boolean;
  onCancel: () => void;
};

export default function LoginRequiredModal({
  visible,
  onCancel,
}: LoginRequiredModalProps) {
  const router = useRouter();

  const handleLoginPress = () => {
    onCancel();
    router.push('/login');
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
        accessibilityLabel="Sign in required"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
      >
        <Pressable
          onPress={onCancel}
          className="absolute inset-0"
          accessibilityRole="button"
          accessibilityLabel="Dismiss sign in prompt"
        />

        <View
          pointerEvents="box-none"
          className="flex-1 items-center justify-center px-6"
        >
          <View
            className="w-full max-w-[480px] rounded-3xl bg-white p-6"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 12,
            }}
          >
            <Text className="text-2xl text-ink font-outfit-black">
              Sign in to like and add spots
            </Text>
            <Text className="mt-3 text-base text-muted font-outfit-medium">
              You can still browse campuses. Sign in if you want to like spots
              or drop your own.
            </Text>

            <View className="mt-6 flex-row gap-3">
              <FeedbackPressable
                onPress={onCancel}
                className="flex-1 items-center justify-center rounded-2xl bg-surface-soft py-4"
                accessibilityLabel="Cancel sign in prompt"
                accessibilityRole="button"
              >
                <Text className="text-base text-ink font-outfit-bold">
                  Not now
                </Text>
              </FeedbackPressable>
              <FeedbackPressable
                haptic="light"
                onPress={handleLoginPress}
                className="flex-1 items-center justify-center rounded-2xl bg-brand py-4"
                accessibilityLabel="Go to sign in"
                accessibilityRole="button"
              >
                <Text className="text-base text-white font-outfit-bold">
                  Sign in
                </Text>
              </FeedbackPressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
