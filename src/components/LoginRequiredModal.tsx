import { useRouter } from 'expo-router';
import { Modal, Pressable, Text, View } from 'react-native';

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
        className="flex-1 items-center justify-center px-6"
        accessibilityViewIsModal
        accessibilityLabel="Login required"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
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
          <Text
            className="text-2xl text-ink font-outfit-black"
          >
            Log in to like and add spots
          </Text>
          <Text
            className="mt-3 text-base text-slate-500 font-outfit-medium"
          >
            Create an account to like spots and post your own.
          </Text>

          <View className="mt-6 flex-row gap-3">
            <Pressable
              onPress={onCancel}
              className="flex-1 items-center justify-center rounded-2xl bg-slate-100 py-4"
              accessibilityLabel="Cancel login prompt"
              accessibilityRole="button"
            >
              <Text
                className="text-base text-ink font-outfit-bold"
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleLoginPress}
              className="flex-1 items-center justify-center rounded-2xl bg-[#21473f] py-4"
              accessibilityLabel="Go to login"
              accessibilityRole="button"
            >
              <Text
                className="text-base text-white font-outfit-bold"
              >
                Log in
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
