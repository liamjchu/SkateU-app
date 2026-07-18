import {
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_900Black,
    useFonts
} from '@expo-google-fonts/outfit';
import * as Linking from 'expo-linking';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../../global.css';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import { useSpotsStore } from '../store/spotsStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_900Black,
  });

  const initAuth = useAuthStore((state) => state.init);
  const setSessionFromUrl = useAuthStore((state) => state.setSessionFromUrl);

  // --- Auth + profile state that drives the username gate ---
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const authInitializing = useAuthStore((state) => state.initializing);
  const profile = useProfileStore((state) => state.profile);
  const profileLoaded = useProfileStore((state) => state.loaded);
  const profileError = useProfileStore((state) => state.error);
  const fetchProfile = useProfileStore((state) => state.fetchProfile);
  const clearProfile = useProfileStore((state) => state.clearProfile);
  const clearMySpots = useSpotsStore((state) => state.clearMySpots);
  const clearLikedSpots = useSpotsStore((state) => state.clearLikedSpots);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Restore any persisted Supabase session and subscribe to auth changes.
    initAuth();
  }, [initAuth]);

  // Load (or clear) the profile whenever the signed-in user changes. Keyed on
  // the user id so token refreshes don't trigger needless refetches.
  useEffect(() => {
    clearMySpots();
    clearLikedSpots();

    if (userId) {
      fetchProfile(userId);
    } else {
      clearProfile();
    }
  }, [clearLikedSpots, clearMySpots, userId, fetchProfile, clearProfile]);

  useEffect(() => {
    // Supabase redirects OAuth and recovery emails to distinct native paths.
    // Both contain a one-time code (or session tokens), which the auth store
    // exchanges for a persisted session before the user reaches a screen.
    const { path: oauthCallbackPath } = Linking.parse(
      Linking.createURL('auth/callback')
    );
    const { path: recoveryCallbackPath } = Linking.parse(
      Linking.createURL('auth/reset-password')
    );

    const handleUrl = (url: string | null) => {
      if (!url) {
        return;
      }

      const { path } = Linking.parse(url);
      const isRecoveryLink = path === recoveryCallbackPath;
      const isAuthCallback = path === oauthCallbackPath || isRecoveryLink;

      if (!isAuthCallback) {
        return;
      }

      setSessionFromUrl(url)
        .then((handled) => {
          if (!handled) {
            return;
          }

          try {
            WebBrowser.dismissBrowser();
          } catch {
            // No browser is open when a cold-start email link is handled.
          }

          if (isRecoveryLink) {
            router.replace('/update-password');
          }
        })
        .catch(() => {
          if (isRecoveryLink) {
            router.replace({
              pathname: '/forgot-password',
              params: { resetError: 'expired' },
            });
          }
        });
    };

    // Handle both a cold-start email link and an app that is already open.
    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) =>
      handleUrl(url)
    );

    return () => subscription.remove();
  }, [router, setSessionFromUrl]);

  // The app is ready to decide on routing once fonts are loaded, the persisted
  // session has been restored, and (if signed in) the profile has resolved.
  const fontsReady = fontsLoaded || !!fontError;
  const profileReady = !userId || profileLoaded;
  const appReady = fontsReady && !authInitializing && profileReady;

  // The gate: a signed-in user with no username is locked onto onboarding.
  // Anonymous users are unaffected (they keep browsing as before).
  const needsOnboarding = !!userId && profileLoaded && !profile?.username;
  const onOnboarding = segments[0] === 'onboarding';
  const routeSettled = needsOnboarding ? onOnboarding : !onOnboarding;

  useEffect(() => {
    if (!appReady) {
      return;
    }

    if (needsOnboarding && !onOnboarding) {
      router.replace('/onboarding');
    } else if (!needsOnboarding && onOnboarding) {
      router.replace('/');
    }
  }, [appReady, needsOnboarding, onOnboarding, router]);

  useEffect(() => {
    // Keep the native splash up until we're both ready and on the correct
    // screen. This prevents any flicker of the wrong screen during the check.
    if (appReady && routeSettled) {
      SplashScreen.hideAsync();
    }
  }, [appReady, routeSettled]);

  // 1. PLACE THE ERROR CHECK HERE FIRST:
  if (fontError) {
    return <Text>Font Load Error: {fontError.message}</Text>;
  }

  // 2. This keeps the app loading until the fonts are ready
  if (!fontsLoaded) {
    return null;
  }

  if (userId && profileError) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="text-center font-outfit-medium text-base text-slate-600">
          {profileError}
        </Text>
        <Pressable
          className="mt-4 rounded-2xl bg-[#21473f] px-5 py-3"
          onPress={() => fetchProfile(userId)}
          accessibilityRole="button"
          accessibilityLabel="Retry loading profile"
        >
          <Text className="font-outfit-bold text-base text-white">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen
          name="profile"
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="change-username"
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="verify-otp"
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="verify-delete-account"
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="map"
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="add-spot"
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="edit-spot"
          options={{
            animation: 'slide_from_right',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
