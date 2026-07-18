import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
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
            className="h-12 w-12 items-center justify-center rounded-full"
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text className="text-xl text-white">❮</Text>
          </Pressable>
          <Text className="font-outfit-bold text-2xl text-white">Username</Text>
          <View className="h-11 w-11" />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow self-center w-full max-w-[640px] px-5 pt-8 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="font-outfit-black text-3xl text-[#1B3B36]">
            Change your username
          </Text>
          <Text className="mt-2 font-outfit-medium text-base text-slate-500">
            Your new username will appear on every spot you&apos;ve added.
          </Text>
          <UsernameForm
            initialUsername={username}
            currentUsername={username}
            submitLabel="Save username"
            submittingLabel="Saving..."
            onSaved={goBack}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
