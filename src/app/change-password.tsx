import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import ChangePasswordForm from '../components/ChangePasswordForm';
import { useAuthStore } from '../store/authStore';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const email = useAuthStore((state) => state.user?.email ?? '');

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/profile');
  };

  return (
    <View className="flex-1 bg-white">
      <View
        className="h-[126px] justify-center bg-[#21473f] px-6 pb-3 pt-[70px]"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 12,
        }}
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={goBack}
            className="h-11 w-11 items-center justify-center rounded-full"
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text className="text-xl text-white">❮</Text>
          </Pressable>

          <Text className="font-outfit-bold text-2xl text-white">
            Account settings
          </Text>

          <View className="h-11 w-11" />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-5 pt-8">
            <ChangePasswordForm email={email} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
