import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UsernameForm } from '../components/username-form';
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
    <View className="flex-1 bg-white">
      <View
        className="bg-[#21473f] px-6 pb-4"
        style={{
          paddingTop: insets.top + 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 12,
        }}
      >
        <Text className="font-outfit-bold text-2xl text-white">
          Choose a username
        </Text>
      </View>

      <View className="flex-1 self-center w-full max-w-[640px] px-5 pt-8 pb-8">
        <Text className="font-outfit-black text-3xl text-[#1B3B36]">
          One last step
        </Text>
        <Text className="mt-2 font-outfit-medium text-base text-slate-500">
          Pick a unique username. This is how other skaters will see you — your
          email stays private.
        </Text>
        <UsernameForm
          initialUsername={suggestedUsername}
          submitLabel="Continue"
          submittingLabel="Saving..."
          showWelcomeOnSave
          onSaved={() => undefined}
        />
      </View>

      <Pressable
        onPress={handleSignOut}
        className="min-h-12 items-center justify-center px-5 py-5"
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Text className="font-outfit-semibold text-base text-slate-500">
          Sign out
        </Text>
      </Pressable>
    </View>
  );
}
