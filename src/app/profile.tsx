import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const [loggingOut, setLoggingOut] = useState(false);

  const email = user?.email ?? '';
  const avatarLetter = email.charAt(0).toUpperCase() || 'P';

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await signOut();
      router.replace('/');
    } catch (error) {
      console.warn('Failed to log out', error);
      setLoggingOut(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <View
        className="h-[126px] bg-[#21473f] px-6 pb-3 flex-row items-center justify-between"
        style={{
          paddingTop: insets.top,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 12,
        }}
      >
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }

            router.replace('/');
          }}
          className="h-11 w-11 items-center justify-center rounded-full"
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text className="text-xl text-white">❮</Text>
        </Pressable>

        <Text
          className="text-2xl text-white"
          style={{ fontFamily: 'Outfit_700Bold' }}
        >
          Profile
        </Text>

        <View className="h-11 w-11" />
      </View>

      <View className="flex-1 px-5 pt-6">
        <View className="items-center rounded-3xl bg-[#EBF2F0] p-6">
          <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-[#21473f]">
            <Text className="font-outfit-black text-4xl text-white">
              {avatarLetter}
            </Text>
          </View>

          <Text className="font-outfit-black text-2xl text-[#1B3B36]">
            Your Profile
          </Text>

          {email ? (
            <Text
              className="mt-1 text-base text-slate-500"
              style={{ fontFamily: 'Outfit_500Medium' }}
            >
              {email}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="p-5 pb-6">
        <Pressable
          onPress={handleLogout}
          disabled={loggingOut}
          className={`w-full items-center justify-center rounded-2xl py-4 ${
            loggingOut ? 'bg-[#21473f]/60' : 'bg-[#21473f]'
          }`}
          accessibilityLabel="Log out"
          accessibilityRole="button"
        >
          <Text className="font-outfit-bold text-lg text-white">
            {loggingOut ? 'Logging out...' : 'Log out'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
