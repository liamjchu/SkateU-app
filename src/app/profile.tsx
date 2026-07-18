import { Feather, Octicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    Text,
    View,
} from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from '../components/FeedbackPressable';
import SettingsBottomSheet from '../components/SettingsBottomSheet';
import { triggerHaptic } from '../lib/haptics';
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
  const likedSpots = useSpotsStore((state) => state.likedSpots);
  const likedLoading = useSpotsStore((state) => state.likedLoading);
  const likedError = useSpotsStore((state) => state.likedError);
  const fetchLikedSpots = useSpotsStore((state) => state.fetchLikedSpots);
  const deleteSpot = useSpotsStore((state) => state.deleteSpot);
  const toggleSpotLike = useSpotsStore((state) => state.toggleSpotLike);

  const sendDeleteAccountOtp = useAuthStore(
    (state) => state.sendDeleteAccountOtp
  );

  const [spotTab, setSpotTab] = useState<'created' | 'liked'>('created');
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [sendingDeleteOtp, setSendingDeleteOtp] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const spotToggleWidth = useSharedValue(0);
  const showingLikedSpots = spotTab === 'liked';
  const spotToggleIndicatorStyle = useAnimatedStyle(() => {
    const optionWidth = Math.max(spotToggleWidth.value - 8, 0) / 2;

    return {
      width: optionWidth,
      transform: [
        {
          translateX: withTiming(showingLikedSpots ? optionWidth : 0, {
            duration: 180,
            easing: Easing.out(Easing.cubic),
          }),
        },
      ],
    };
  });

  const handleSettingsPress = () => {
    setShowSettingsSheet(true);
  };

  const closeSettingsSheet = () => {
    setShowSettingsSheet(false);
  };

  const handleChangeUsername = () => {
    closeSettingsSheet();
    router.push('/change-username');
  };

  const handleChangePassword = () => {
    closeSettingsSheet();
    router.push('/change-password');
  };

  const handleSettingsLogout = () => {
    closeSettingsSheet();
    handleLogout();
  };

  const handleSettingsDeleteAccount = () => {
    closeSettingsSheet();
    handleDeleteAccount();
  };

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
        fetchLikedSpots(accessToken);
      }

      return () => {
        setShowSettingsSheet(false);
      };
    }, [fetchLikedSpots, fetchMySpots, session?.access_token])
  );

  const displayedSpots = showingLikedSpots ? likedSpots : mySpots;
  const displayedLoading = showingLikedSpots ? likedLoading : myLoading;
  const displayedError = showingLikedSpots ? likedError : myError;

  const handleSpotTab = (tab: 'created' | 'liked') => {
    if (spotTab === tab) {
      return;
    }

    setSpotTab(tab);
    triggerHaptic('selection');
  };

  const performLogout = async () => {
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

  const handleLogout = () => {
    triggerHaptic('warning');
    Alert.alert('Log out?', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: performLogout },
    ]);
  };

  const performDeleteAccount = async () => {
    if (sendingDeleteOtp || !email) {
      return;
    }

    setSendingDeleteOtp(true);

    try {
      await sendDeleteAccountOtp(email);
      router.push(`/verify-delete-account?email=${encodeURIComponent(email)}`);
    } catch (error) {
      Alert.alert(
        'Could not send verification code',
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setSendingDeleteOtp(false);
    }
  };

  const handleDeleteAccount = () => {
    triggerHaptic('warning');
    Alert.alert(
      'Delete your account?',
      'This will permanently delete your account and profile. This cannot be undone. Your uploaded spots will remain, but will no longer be linked to your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: performDeleteAccount,
        },
      ]
    );
  };

  const handleSpotPress = (spot: Spot) => {
    router.push({
      pathname: '/map',
      params: {
        lat: spot.latitude.toString(),
        lng: spot.longitude.toString(),
        schoolId: spot.schoolId ?? '',
        schoolName: spot.schoolName || 'Campus map',
        schoolCity: spot.city,
        schoolState: spot.state,
        spotId: spot.id,
      },
    });
  };

  const handleUnlike = async (spot: Spot) => {
    const accessToken = session?.access_token;
    if (!accessToken || likingId) {
      return;
    }

    setLikingId(spot.id);
    try {
      await toggleSpotLike(spot.id, true, accessToken);
    } catch (error) {
      Alert.alert(
        'Could not unlike spot',
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setLikingId(null);
    }
  };

  const handleRetryDisplayedSpots = () => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      return;
    }

    if (showingLikedSpots) {
      fetchLikedSpots(accessToken);
    } else {
      fetchMySpots(accessToken);
    }
  };

  const handleEdit = (spot: Spot) => {
    router.push(`/edit-spot?id=${encodeURIComponent(spot.id)}`);
  };

  const handleDelete = (spot: Spot) => {
    triggerHaptic('warning');
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
        <FeedbackPressable
          haptic="light"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }

            router.replace('/');
          }}
          className="h-12 w-12 items-center justify-center rounded-full"
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text className="text-xl text-white">❮</Text>
        </FeedbackPressable>

        <Text
          className="font-outfit-bold text-2xl text-white"
        >
          Profile
        </Text>

        <FeedbackPressable
          haptic="light"
          onPress={handleSettingsPress}
          className="h-12 w-12 items-center justify-center rounded-full"
          accessibilityLabel="Open settings"
          accessibilityRole="button"
        >
          <Feather name="settings" size={23} color="#FFFFFF" />
        </FeedbackPressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="self-center w-full max-w-[720px] px-5 pb-6 pt-6"
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
              className="mt-1 font-outfit-medium text-base text-slate-500"
            >
              {email}
            </Text>
          ) : null}
        </View>

        <View
          className="relative mt-8 flex-row rounded-2xl bg-[#F4F7F6] p-1"
          onLayout={(event) => {
            spotToggleWidth.value = event.nativeEvent.layout.width;
          }}
        >
          <Animated.View
            pointerEvents="none"
            className="absolute rounded-xl bg-white"
            style={[
              {
                left: 4,
                top: 4,
                bottom: 4,
              },
              spotToggleIndicatorStyle,
            ]}
          />
          <FeedbackPressable
            onPress={() => handleSpotTab('created')}
            className="z-10 min-h-12 flex-1 items-center justify-center rounded-xl py-3"
            accessibilityRole="tab"
            accessibilityLabel={`Your spots${mySpots.length > 0 ? `, ${mySpots.length}` : ''}`}
            accessibilityState={{ selected: !showingLikedSpots }}
          >
            <Text
              className={`font-outfit-bold text-sm ${
                !showingLikedSpots ? 'text-[#1B3B36]' : 'text-slate-500'
              }`}
            >
              Your Spots {mySpots.length > 0 ? `(${mySpots.length})` : ''}
            </Text>
          </FeedbackPressable>
          <FeedbackPressable
            onPress={() => handleSpotTab('liked')}
            className="z-10 min-h-12 flex-1 items-center justify-center rounded-xl py-3"
            accessibilityRole="tab"
            accessibilityLabel={`Liked spots${likedSpots.length > 0 ? `, ${likedSpots.length}` : ''}`}
            accessibilityState={{ selected: showingLikedSpots }}
          >
            <Text
              className={`font-outfit-bold text-sm ${
                showingLikedSpots ? 'text-[#1B3B36]' : 'text-slate-500'
              }`}
            >
              Liked Spots {likedSpots.length > 0 ? `(${likedSpots.length})` : ''}
            </Text>
          </FeedbackPressable>
        </View>

        {displayedError && displayedSpots.length > 0 ? (
          <View className="mt-4 flex-row items-center rounded-2xl border border-[#F3B7B2] bg-[#FBE9E7] px-4 py-3">
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="flex-1 pr-3 font-outfit-medium text-sm text-[#B45F58]"
            >
              Something went wrong. Your previous content is still shown where possible.
            </Text>
            <FeedbackPressable
              onPress={handleRetryDisplayedSpots}
              className="rounded-xl bg-[#21473f] px-3 py-2"
              accessibilityRole="button"
              accessibilityLabel={`Retry loading ${showingLikedSpots ? 'liked' : 'created'} spots`}
            >
              <Text className="font-outfit-bold text-xs text-white">Retry</Text>
            </FeedbackPressable>
          </View>
        ) : null}

        {displayedLoading && displayedSpots.length === 0 ? (
          <View className="mt-6 items-center">
            <ActivityIndicator size="small" color="#21473f" />
          </View>
        ) : displayedError ? (
          <View className="mt-4 items-center rounded-2xl border border-[#F3B7B2] bg-[#FBE9E7] p-5">
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="text-center font-outfit-medium text-sm text-[#B45F58]"
            >
              Something went wrong while loading your spots.
            </Text>
            <FeedbackPressable
              onPress={handleRetryDisplayedSpots}
              className="mt-3 rounded-xl bg-[#21473f] px-4 py-2"
              accessibilityRole="button"
              accessibilityLabel={`Retry loading ${showingLikedSpots ? 'liked' : 'created'} spots`}
            >
              <Text className="font-outfit-bold text-xs text-white">Retry</Text>
            </FeedbackPressable>
          </View>
        ) : displayedSpots.length === 0 ? (
          <View className="mt-4 rounded-2xl bg-[#F4F7F6] p-6">
            <Text
              className="font-outfit-medium text-center text-sm text-slate-500"
            >
              {showingLikedSpots
                ? 'Spots you like will appear here.'
                : 'You haven\'t added any spots yet. Find a campus map and tap the + button to add your first spot.'}
            </Text>
          </View>
        ) : (
          <View className="mt-3">
            {displayedSpots.map((spot) => (
              <View
                key={spot.id}
                className="mb-3 flex-row items-center rounded-2xl border border-[#E3EAE8] bg-white p-3"
              >
                <FeedbackPressable
                  onPress={() => handleSpotPress(spot)}
                  className="min-w-0 flex-1 flex-row items-center"
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${spot.name} on the ${spot.schoolName || 'campus'} map`}
                  accessibilityHint="Opens the campus map and selects this spot"
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

                  <View className="ml-3 min-w-0 flex-1">
                    <Text className="font-outfit-bold text-base text-[#1B3B36]">
                      {spot.name}
                    </Text>
                    <View className="mt-0.5 flex-row items-center">
                      <Feather name="map-pin" size={11} color="#64748b" />
                      <Text className="font-outfit-semibold ml-1 flex-1 text-xs text-slate-500" numberOfLines={1}>
                        {spot.schoolName || 'Campus map'}{spot.city || spot.state ? ` · ${spot.city}${spot.city && spot.state ? ', ' : ''}${spot.state}` : ''}
                      </Text>
                    </View>
                    <Text className="font-outfit-medium mt-0.5 text-sm text-slate-500" numberOfLines={2}>
                      {spot.description}
                    </Text>
                    <View className="mt-1 flex-row items-center">
                      <Octicons name="heart-fill" size={12} color="#B45F58" />
                      <Text className="font-outfit-semibold ml-1 text-xs text-slate-500">
                        {spot.likeCount ?? 0}
                      </Text>
                    </View>
                  </View>
                </FeedbackPressable>

                {showingLikedSpots ? (
                  <FeedbackPressable
                    onPress={() => handleUnlike(spot)}
                    disabled={likingId === spot.id}
                    className="ml-2 h-10 w-10 items-center justify-center rounded-full bg-[#FBE9E7]"
                    accessibilityLabel={`Unlike ${spot.name}`}
                    accessibilityRole="button"
                    accessibilityState={{ busy: likingId === spot.id }}
                  >
                    {likingId === spot.id ? (
                      <ActivityIndicator size="small" color="#B45F58" />
                    ) : (
                      <Octicons name="heart-fill" size={17} color="#B45F58" />
                    )}
                  </FeedbackPressable>
                ) : deletingId === spot.id ? (
                  <View className="ml-2 h-10 w-10 items-center justify-center">
                    <ActivityIndicator size="small" color="#21473f" />
                  </View>
                ) : (
                  <View className="ml-2 flex-row">
                    <FeedbackPressable
                      haptic="light"
                      onPress={() => handleEdit(spot)}
                      className="h-10 w-10 items-center justify-center rounded-full"
                      accessibilityLabel={`Edit ${spot.name}`}
                      accessibilityRole="button"
                    >
                      <Feather name="edit-2" size={17} color="#21473f" />
                    </FeedbackPressable>
                    <FeedbackPressable
                      onPress={() => handleDelete(spot)}
                      className="h-10 w-10 items-center justify-center rounded-full"
                      accessibilityLabel={`Delete ${spot.name}`}
                      accessibilityRole="button"
                    >
                      <Feather name="trash-2" size={17} color="#B45F58" />
                    </FeedbackPressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <SettingsBottomSheet
        visible={showSettingsSheet}
        onClose={closeSettingsSheet}
        onChangeUsername={handleChangeUsername}
        onChangePassword={handleChangePassword}
        onLogout={handleSettingsLogout}
        onDeleteAccount={handleSettingsDeleteAccount}
        deleteAccountDisabled={sendingDeleteOtp}
        loggingOut={loggingOut}
      />
    </View>
  );
}
