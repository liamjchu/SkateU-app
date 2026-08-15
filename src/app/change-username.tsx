import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import ScreenHeader from '../components/screen-header';
import { UsernameForm } from '../components/username-form';
import { useProfileStore } from '../store/profileStore';

export default function ChangeUsernameScreen() {
  const router = useRouter();
  const username = useProfileStore((state) => state.profile?.username ?? '');

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/settings');
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Username" onBack={goBack} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow self-center w-full max-w-[640px] px-6 pt-8 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="font-outfit-black text-2xl text-ink">
            Change your username
          </Text>
          <Text className="mt-2 font-outfit-medium text-base text-muted">
            Your new username will appear on every spot you&apos;ve added.
          </Text>
          <UsernameForm
            initialUsername={username}
            currentUsername={username}
            submitLabel="Save username"
            submittingLabel="Saving…"
            onSaved={goBack}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
