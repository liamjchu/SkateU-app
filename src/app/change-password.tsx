import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import ChangePasswordForm from '../components/ChangePasswordForm';
import ScreenHeader from '../components/screen-header';
import { useAuthStore } from '../store/authStore';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const email = useAuthStore((state) => state.user?.email ?? '');

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/settings');
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Change password" onBack={goBack} />

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
          <View className="flex-1 self-center w-full max-w-[640px] px-5 pt-8 pb-8">
            <ChangePasswordForm email={email} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
