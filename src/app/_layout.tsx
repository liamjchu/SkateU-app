import {
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_900Black,
    useFonts
} from '@expo-google-fonts/outfit';
import * as Linking from 'expo-linking';
import { SplashScreen, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../../global.css';
import { SpotsProvider } from '../context/SpotsContext';
import { useAuthStore } from '../store/authStore';

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

  useEffect(() => {
    // Restore any persisted Supabase session and subscribe to auth changes.
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    // Global deep link listener. When Supabase redirects back to the app
    // after Google OAuth, the URL carries the access/refresh tokens. We hand
    // that URL to setSessionFromUrl, which extracts the tokens and calls
    // supabase.auth.setSession() to hydrate the client. That in turn triggers
    // onAuthStateChange in the auth store, so the whole app sees the new user.
    const handleUrl = (url: string | null) => {
      // Only act on our OAuth callback URLs; ignore other deep links.
      // PKCE returns "?code=", implicit returns "#access_token=".
      if (url && (url.includes('code=') || url.includes('access_token'))) {
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

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

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
