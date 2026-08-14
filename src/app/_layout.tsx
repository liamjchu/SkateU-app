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
import { Image, Platform, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
    configureReanimatedLogger,
    ReanimatedLogLevel,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import '../../global.css';
import { colors } from '../constants/colors';
import images from '../constants/images';
import { checkAppleCredentialStatus } from '../lib/appleAuthentication';
import { useAuthStore } from '../store/authStore';
import { useFavorites } from '../store/favoritesStore';
import { useProfileStore } from '../store/profileStore';
import { useSpotsStore } from '../store/spotsStore';

if (Platform.OS !== 'web') {
  void SplashScreen.preventAutoHideAsync();
}

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

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
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Restore any persisted Supabase session and subscribe to auth changes.
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    // Persistent saved schools are browser/device state, so restore them only
    // after client mounting instead of during the web server render.
    void useFavorites.persist.rehydrate();
  }, []);

  useEffect(() => {
    // Apple only returns an ID token during sign-in, so retain its stable user
    // ID and verify that Apple still considers that credential authorized.
    void checkAppleCredentialStatus().catch((error: unknown) => {
      console.warn('Could not verify the Apple credential status.', error);
    });
  }, []);

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
  const profileReady = !userId || profileLoaded || Boolean(profileError);
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
    // Keep the native splash up until fonts are ready, then hand off to a
    // centered in-app lockup so auth/profile restoration never flashes a
    // misaligned splash image.
    if (Platform.OS !== 'web' && fontsReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  // 1. PLACE THE ERROR CHECK HERE FIRST:
  if (fontError) {
    return <Text>Font Load Error: {fontError.message}</Text>;
  }

  // Native waits for its splash to hand off with the correct font. Web renders
  // immediately so server/browser output cannot be blank while fonts load.
  if (!fontsLoaded && Platform.OS !== 'web') {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          contentStyle: { backgroundColor: colors.surface },
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="change-username" />
        <Stack.Screen name="change-password" />
        <Stack.Screen
          name="login"
          options={{ animationTypeForReplace: 'pop' }}
        />
        <Stack.Screen
          name="signup"
          options={{ animationTypeForReplace: 'pop' }}
        />
        <Stack.Screen
          name="forgot-password"
          options={{ animationTypeForReplace: 'pop' }}
        />
        <Stack.Screen name="update-password" />
        <Stack.Screen name="verify-otp" />
        <Stack.Screen name="verify-delete-account" />
        <Stack.Screen name="map" options={{ contentStyle: { backgroundColor: colors.brand } }} />
        <Stack.Screen name="add-spot" options={{ contentStyle: { backgroundColor: colors.surface } }} />
        <Stack.Screen name="edit-spot" options={{ contentStyle: { backgroundColor: colors.surface } }} />
      </Stack>

      {!appReady || !routeSettled ? (
        <View
          className="absolute inset-0 z-50 items-center justify-center bg-surface"
          accessibilityRole="progressbar"
          accessibilityLabel="Loading SkateU"
        >
          <Image
            source={images.brandLockupCentered}
            accessibilityLabel="SkateU"
            style={{ width: 195, height: 36 }}
            resizeMode="contain"
          />
        </View>
      ) : userId && profileError ? (
        <View
          className="absolute left-4 right-4 z-50 flex-row items-center rounded-2xl bg-field px-4 py-3"
          style={{
            top: insets.top + 12,
          }}
        >
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="flex-1 pr-3 font-outfit-medium text-base text-ink"
          >
            {profileError}
          </Text>
          <Pressable
            className="rounded-xl bg-accent px-3 py-2"
            onPress={() => fetchProfile(userId)}
            accessibilityRole="button"
            accessibilityLabel="Retry loading profile"
          >
            <Text className="font-outfit-bold text-sm text-brand">Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </GestureHandlerRootView>
  );
}
