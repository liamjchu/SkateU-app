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
    <Modal visible={visible} transparent animationType="fade">
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
      >
        <View
          className="w-full rounded-3xl bg-white p-6"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 12,
          }}
        >
          <Text
            className="text-2xl text-[#1B3B36]"
            style={{ fontFamily: 'Outfit_900Black' }}
          >
            Login required
          </Text>
          <Text
            className="mt-3 text-base text-slate-500"
            style={{ fontFamily: 'Outfit_500Medium' }}
          >
            You need to login for this.
          </Text>

          <View className="mt-6 flex-row gap-3">
            <Pressable
              onPress={onCancel}
              className="flex-1 items-center justify-center rounded-2xl bg-slate-100 py-4"
              accessibilityLabel="Cancel login prompt"
              accessibilityRole="button"
            >
              <Text
                className="text-base text-[#1B3B36]"
                style={{ fontFamily: 'Outfit_700Bold' }}
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
                className="text-base text-white"
                style={{ fontFamily: 'Outfit_700Bold' }}
              >
                Login
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
