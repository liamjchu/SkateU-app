import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import { useSpotsStore } from '../store/spotsStore';
import type { Spot } from '../types/spot';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const username = useProfileStore((state) => state.profile?.username ?? '');

  const mySpots = useSpotsStore((state) => state.mySpots);
  const myLoading = useSpotsStore((state) => state.myLoading);
  const myError = useSpotsStore((state) => state.myError);
  const fetchMySpots = useSpotsStore((state) => state.fetchMySpots);
  const deleteSpot = useSpotsStore((state) => state.deleteSpot);

  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const email = user?.email ?? '';
  // Prefer the username for the avatar initial, falling back to the email.
  const avatarLetter =
    username.charAt(0).toUpperCase() || email.charAt(0).toUpperCase() || 'P';

  // Load the user's spots whenever the screen regains focus, so edits/deletes
  // made on the edit screen are reflected on return.
  useFocusEffect(
    useCallback(() => {
      const accessToken = session?.access_token;
      if (accessToken) {
        fetchMySpots(accessToken);
      }
    }, [fetchMySpots, session?.access_token])
  );

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

  const handleEdit = (spot: Spot) => {
    router.push(`/edit-spot?id=${encodeURIComponent(spot.id)}`);
  };

  const handleDelete = (spot: Spot) => {
    Alert.alert(
      'Delete spot?',
      `"${spot.name}" will be permanently removed for everyone. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const accessToken = session?.access_token;
            if (!accessToken) {
              Alert.alert('You must be signed in to delete a spot.');
              return;
            }

            setDeletingId(spot.id);

            try {
              await deleteSpot(spot.id, accessToken);
            } catch (error) {
              Alert.alert(
                'Could not delete spot',
                error instanceof Error && error.message.length > 0
                  ? error.message
                  : 'Please try again.'
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
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

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-6 pt-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center rounded-3xl bg-[#EBF2F0] p-6">
          <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-[#21473f]">
            <Text className="font-outfit-black text-4xl text-white">
              {avatarLetter}
            </Text>
          </View>

          <Text className="font-outfit-black text-2xl text-[#1B3B36]">
            {username ? `@${username}` : 'Your Profile'}
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

        <View className="mt-8 flex-row items-center justify-between">
          <Text
            className="text-lg text-[#1B3B36]"
            style={{ fontFamily: 'Outfit_700Bold' }}
          >
            Your Spots
          </Text>
          {mySpots.length > 0 ? (
            <Text
              className="text-sm text-slate-500"
              style={{ fontFamily: 'Outfit_600SemiBold' }}
            >
              {mySpots.length}
            </Text>
          ) : null}
        </View>

        {myLoading && mySpots.length === 0 ? (
          <View className="mt-6 items-center">
            <ActivityIndicator size="small" color="#21473f" />
          </View>
        ) : myError && mySpots.length === 0 ? (
          <Text className="mt-4 text-center text-sm text-red-600">{myError}</Text>
        ) : mySpots.length === 0 ? (
          <View className="mt-4 rounded-2xl bg-[#F4F7F6] p-6">
            <Text
              className="text-center text-sm text-slate-500"
              style={{ fontFamily: 'Outfit_500Medium' }}
            >
              You haven&apos;t added any spots yet. Find a campus map and tap
              the + button to add your first spot.
            </Text>
          </View>
        ) : (
          <View className="mt-3">
            {mySpots.map((spot) => (
              <View
                key={spot.id}
                className="mb-3 flex-row items-center rounded-2xl border border-[#E3EAE8] bg-white p-3"
              >
                {spot.imageUris.length > 0 ? (
                  <Image
                    source={{ uri: spot.imageUris[0] }}
                    className="h-16 w-16 rounded-xl"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="h-16 w-16 items-center justify-center rounded-xl bg-slate-100">
                    <Feather name="image" size={20} color="#94a3b8" />
                  </View>
                )}

                <View className="ml-3 flex-1">
                  <Text
                    className="text-base text-[#1B3B36]"
                    style={{ fontFamily: 'Outfit_700Bold' }}
                    numberOfLines={1}
                  >
                    {spot.name}
                  </Text>
                  {spot.schoolName ? (
                    <View className="mt-0.5 flex-row items-center">
                      <Feather name="map-pin" size={11} color="#64748b" />
                      <Text
                        className="ml-1 flex-1 text-xs text-slate-500"
                        style={{ fontFamily: 'Outfit_600SemiBold' }}
                        numberOfLines={1}
                      >
                        {spot.schoolName}
                      </Text>
                    </View>
                  ) : null}
                  <Text
                    className="mt-0.5 text-sm text-slate-500"
                    style={{ fontFamily: 'Outfit_500Medium' }}
                    numberOfLines={2}
                  >
                    {spot.description}
                  </Text>
                </View>

                {deletingId === spot.id ? (
                  <View className="ml-2 h-10 w-10 items-center justify-center">
                    <ActivityIndicator size="small" color="#21473f" />
                  </View>
                ) : (
                  <View className="ml-2 flex-row">
                    <Pressable
                      onPress={() => handleEdit(spot)}
                      className="h-10 w-10 items-center justify-center rounded-full"
                      accessibilityLabel={`Edit ${spot.name}`}
                      accessibilityRole="button"
                    >
                      <Feather name="edit-2" size={18} color="#21473f" />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDelete(spot)}
                      className="h-10 w-10 items-center justify-center rounded-full"
                      accessibilityLabel={`Delete ${spot.name}`}
                      accessibilityRole="button"
                    >
                      <Feather name="trash-2" size={18} color="#DC2626" />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

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
