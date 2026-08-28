import { useGuardedRouter } from '../lib/navigationGuard';
import { ScrollView, View } from 'react-native';
import ChangePasswordForm from '../components/ChangePasswordForm';
import KeyboardShiftView from '../components/keyboard-shift-view';
import ScreenHeader from '../components/screen-header';
import { useAuthStore } from '../store/authStore';
import { userCanSignInWithPassword } from '../lib/authAccount';

export default function ChangePasswordScreen() {
  const router = useGuardedRouter();
  const email = useAuthStore((state) => state.user?.email ?? '');
  const canSignInWithPassword = useAuthStore((state) =>
    userCanSignInWithPassword(state.user)
  );
  const isSetMode = !canSignInWithPassword;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/settings');
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title={isSetMode ? 'Set a password' : 'Change password'} onBack={goBack} />

      <KeyboardShiftView>
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={false}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 self-center w-full max-w-[640px] px-6 pt-8 pb-8">
            <ChangePasswordForm email={email} mode={isSetMode ? 'set' : 'change'} />
          </View>
        </ScrollView>
      </KeyboardShiftView>
    </View>
  );
}
