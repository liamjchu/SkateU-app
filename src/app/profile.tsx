import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      <View className="bg-[#21473f] pt-25 pb-8 px-6 flex-row items-center justify-between">
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

        <Text className="font-outfit-black text-3xl text-white">
          Profile
        </Text>

        <View className="h-11 w-11" />
      </View>

      <View className="flex-1 px-5 pt-6">
        <View className="items-center rounded-3xl bg-[#EBF2F0] p-6">
          <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-[#21473f]">
            <Text className="font-outfit-black text-4xl text-white">
              P
            </Text>
          </View>

          <Text className="font-outfit-black text-2xl text-[#1B3B36]">
            Your Profile
          </Text>
        </View>
      </View>

      <View className="p-5 pb-6">
        <Pressable
          className="w-full items-center justify-center rounded-2xl bg-[#21473f] py-4"
          accessibilityLabel="Log out"
          accessibilityRole="button"
        >
          <Text className="font-outfit-bold text-lg text-white">
            Log out
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
