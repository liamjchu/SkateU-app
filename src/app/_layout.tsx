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
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../../global.css';
import { SpotsProvider } from '../context/SpotsContext';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';

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
  const fetchProfile = useProfileStore((state) => state.fetchProfile);
  const clearProfile = useProfileStore((state) => state.clearProfile);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Restore any persisted Supabase session and subscribe to auth changes.
    initAuth();
  }, [initAuth]);

  // Load (or clear) the profile whenever the signed-in user changes. Keyed on
  // the user id so token refreshes don't trigger needless refetches.
  useEffect(() => {
    if (userId) {
      fetchProfile(userId);
    } else {
      clearProfile();
    }
  }, [userId, fetchProfile, clearProfile]);

  useEffect(() => {
    // Global deep link listener. When Supabase redirects back to the app
    // after Google OAuth, the URL carries the access/refresh tokens. We hand
    // that URL to setSessionFromUrl, which extracts the tokens and calls
    // supabase.auth.setSession() to hydrate the client. That in turn triggers
    // onAuthStateChange in the auth store, so the whole app sees the new user.
    // The exact callback path we asked Supabase to redirect to. Comparing
    // against this avoids reacting to unrelated deep links that merely happen
    // to contain "code=" or "access_token".
    const { path: callbackPath } = Linking.parse(
      Linking.createURL('auth/callback')
    );

    const handleUrl = (url: string | null) => {
      if (!url) {
        return;
      }

      // Only act on our OAuth callback URL; ignore other deep links.
      const { path } = Linking.parse(url);
      if (path === callbackPath) {
        setSessionFromUrl(url)
          .then((handled) => {
            // If the browser sheet was left spinning, close it now.
            if (handled) {
              try {
                WebBrowser.dismissBrowser();
              } catch {
                // No browser open to dismiss; ignore.
              }
            }
          })
          .catch(() => {
            // Ignore malformed/expired links; the user can just try again.
          });
      }
    };

    // Handle the cold-start case where the app was opened by the redirect URL.
    Linking.getInitialURL().then(handleUrl);

    // Handle the warm case where the app is already running (Expo Go flow).
    const subscription = Linking.addEventListener('url', ({ url }) =>
      handleUrl(url)
    );

    return () => subscription.remove();
  }, [setSessionFromUrl]);

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

  // 3. FIXED: Wrapped Stack inside SpotsProvider so all screens can access spots data
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SpotsProvider>
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
        </Stack>
      </SpotsProvider>
    </GestureHandlerRootView>
  );
}
