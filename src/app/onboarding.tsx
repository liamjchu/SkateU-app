import { useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from '../components/FeedbackPressable';
import { UsernameForm } from '../components/username-form';
import { StickerStripe } from '../components/sticker';
import { slugifyUsername } from '../lib/username';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const clearProfile = useProfileStore((state) => state.clearProfile);

  const suggestedUsername = useMemo(() => {
    const meta = user?.user_metadata;
    const rawName =
      typeof meta?.full_name === 'string'
        ? meta.full_name
        : typeof meta?.name === 'string'
          ? meta.name
          : '';
    return slugifyUsername(rawName);
  }, [user]);

  const handleSignOut = async () => {
    try {
      clearProfile();
      await signOut();
    } catch {
      // The auth listener will settle state if sign-out cannot complete here.
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <View className="bg-brand">
        <View
          className="px-6 pb-4"
          style={{
            paddingTop: insets.top + 16,
          }}
        >
          <Text className="font-outfit-bold text-2xl text-white">
            Choose a username
          </Text>
        </View>
        <StickerStripe />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow self-center w-full max-w-[640px] px-6 pt-8 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="font-outfit-black text-2xl text-ink">
            One last step
          </Text>
          <Text className="mt-2 font-outfit-medium text-base text-muted">
            Pick a unique username. This is how other skaters will see you — your
            email stays private.
          </Text>
          <UsernameForm
            initialUsername={suggestedUsername}
            submitLabel="Continue"
            submittingLabel="Saving…"
            showWelcomeOnSave
            onSaved={() => undefined}
          />
          <FeedbackPressable
            onPress={handleSignOut}
            className="mt-auto min-h-12 items-center justify-center py-5"
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text className="font-outfit-semibold text-base text-muted">
              Sign out
            </Text>
          </FeedbackPressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
