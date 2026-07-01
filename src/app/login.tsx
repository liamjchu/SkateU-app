import { useRouter } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      <View className="bg-[#21473f] px-6 pb-8 pt-25">
        <View className="flex-row items-center justify-between">
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
            className="text-3xl text-white"
            style={{ fontFamily: 'Outfit_900Black' }}
          >
            Login
          </Text>

          <View className="h-11 w-11" />
        </View>
      </View>

      <View className="flex-1 px-5 pt-8">
        <Text
          className="text-3xl text-[#1B3B36]"
          style={{ fontFamily: 'Outfit_900Black' }}
        >
          Welcome back
        </Text>
        <Text
          className="mt-2 text-base text-slate-500"
          style={{ fontFamily: 'Outfit_500Medium' }}
        >
          Login to use your profile and add campus skate spots.
        </Text>

        <View className="mt-8 gap-4">
          <TextInput
            placeholder="Username or email"
            placeholderTextColor="#8E9AA6"
            autoCapitalize="none"
            keyboardType="email-address"
            className="rounded-2xl bg-[#F0F3F5] px-5 py-4 text-base text-[#1B3B36]"
            style={{ fontFamily: 'Outfit_600SemiBold' }}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor="#8E9AA6"
            secureTextEntry
            className="rounded-2xl bg-[#F0F3F5] px-5 py-4 text-base text-[#1B3B36]"
            style={{ fontFamily: 'Outfit_600SemiBold' }}
          />

          <Pressable
            className="mt-2 items-center justify-center rounded-2xl bg-[#21473f] py-4"
            accessibilityLabel="Login"
            accessibilityRole="button"
          >
            <Text
              className="text-lg text-white"
              style={{ fontFamily: 'Outfit_700Bold' }}
            >
              Login
            </Text>
          </Pressable>

          <Pressable
            className="items-center justify-center rounded-2xl border border-slate-200 py-4"
            accessibilityLabel="Sign in with Google"
            accessibilityRole="button"
          >
            <Text
              className="text-base text-[#1B3B36]"
              style={{ fontFamily: 'Outfit_700Bold' }}
            >
              Sign in with Google
            </Text>
          </Pressable>

          <Pressable
            className="items-center justify-center rounded-2xl border border-slate-200 py-4"
            accessibilityLabel="Sign in with Apple"
            accessibilityRole="button"
          >
            <Text
              className="text-base text-[#1B3B36]"
              style={{ fontFamily: 'Outfit_700Bold' }}
            >
              Sign in with Apple
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
