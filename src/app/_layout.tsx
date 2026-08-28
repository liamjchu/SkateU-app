import {
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_900Black,
    useFonts
} from '@expo-google-fonts/outfit';
import * as Sentry from '@sentry/react-native';
import * as Linking from 'expo-linking';
import { SplashScreen, Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PostHogErrorBoundary } from 'posthog-react-native';
import { useIsFocused } from '@react-navigation/native';
import {
    configureReanimatedLogger,
    ReanimatedLogLevel,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import '../../global.css';
import AuthNoticeBanner from '../components/AuthNoticeBanner';
import StartupLoadingOverlay from '../components/startup-loading-overlay';
import { colors } from '../constants/colors';
import { checkAppleCredentialStatus } from '../lib/appleAuthentication';
import {
    getLegalGate,
    isAllowedDuringLegalGate,
    isSettledLegalRoute,
    legalGateRedirectPath,
} from '../lib/legalAcceptance';
import { shouldLeaveAuthEntryRoute } from '../lib/authNavigation';
import { toUserFacingError } from '../lib/userFacingError';
import { useAuthNoticeStore } from '../store/authNoticeStore';
import { useAuthStore } from '../store/authStore';
import { useBlocksStore } from '../store/blocksStore';
import { useCommentsStore } from '../store/commentsStore';
import { useDraftSpotsStore } from '../store/draftSpotsStore';
import { useFavorites } from '../store/favoritesStore';
import { useProfileStore } from '../store/profileStore';
import { useSchools } from '../store/schoolsStore';
import { useSpotsStore } from '../store/spotsStore';
import {
    AnalyticsProvider,
    captureAnalyticsScreen,
    identifyAnalyticsUser,
    resetAnalyticsUser,
} from '../lib/analytics';
import {
    applyCrashReportingUpdateContext,
    clearCrashReportingUser,
    setCrashReportingUser,
} from '../lib/crashReporting';

Sentry.init({
  dsn: 'https://7bd71649d209fd9fa912e31ffc0598ca@o4511957074182145.ingest.us.sentry.io/4511957099741184',
  sendDefaultPii: true,
  enableLogs: true,
  tracesSampleRate: 0,
  enableAutoSessionTracking: true,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
applyCrashReportingUpdateContext();

if (Platform.OS !== 'web') {
  void SplashScreen.preventAutoHideAsync();
}

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

function RootErrorFallback() {
  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="alert"
    >
      <Text>Something went wrong. Please restart the app.</Text>
    </View>
  );
}

function FocusedTouchGate({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  return (
    <View style={{ flex: 1 }} pointerEvents={focused ? 'auto' : 'none'}>
      {children}
    </View>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_900Black,
  });

  const initAuth = useAuthStore((state) => state.init);
  const setSessionFromUrl = useAuthStore((state) => state.setSessionFromUrl);
  const signOut = useAuthStore((state) => state.signOut);
  const showAuthNotice = useAuthNoticeStore((state) => state.showAuthNotice);

  // --- Auth + profile state that drives the username gate ---
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const userEmail = useAuthStore((state) => state.user?.email ?? undefined);
  const accessToken = useAuthStore((state) => state.session?.access_token ?? null);
  const authInitializing = useAuthStore((state) => state.initializing);
  const passwordRecovery = useAuthStore((state) => state.passwordRecovery);
  const profile = useProfileStore((state) => state.profile);
  const profileLoaded = useProfileStore((state) => state.loaded);
  const profileLoading = useProfileStore((state) => state.loading);
  const profileError = useProfileStore((state) => state.error);
  const fetchProfile = useProfileStore((state) => state.fetchProfile);
  const clearProfile = useProfileStore((state) => state.clearProfile);
  const clearMySpots = useSpotsStore((state) => state.clearMySpots);
  const clearLikedSpots = useSpotsStore((state) => state.clearLikedSpots);
  const clearReportedSpotIds = useSpotsStore(
    (state) => state.clearReportedSpotIds
  );
  const fetchBlocks = useBlocksStore((state) => state.fetchBlocks);
  const clearBlocks = useBlocksStore((state) => state.clear);
  const setSessionUserId = useSpotsStore((state) => state.setSessionUserId);
  const [cachesReady, setCachesReady] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const splashLogoWidth = Math.min(240, Math.max(168, windowWidth * 0.68));
  const splashLogoHeight = splashLogoWidth * (36 / 195);

  useEffect(() => {
    // Restore any persisted Supabase session and subscribe to auth changes.
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (userId) {
      identifyAnalyticsUser(userId, { email: userEmail });
      setCrashReportingUser(userId);
      return;
    }

    resetAnalyticsUser();
    clearCrashReportingUser();
  }, [userEmail, userId]);

  useEffect(() => {
    captureAnalyticsScreen(pathname);
  }, [pathname]);

  useEffect(() => {
    // Persistent saved schools are browser/device state, so restore them only
    // after client mounting instead of during the web server render.
    void Promise.all([
      useFavorites.persist.rehydrate(),
      useDraftSpotsStore.persist.rehydrate(),
      useSpotsStore.persist.rehydrate(),
      useSchools.persist.rehydrate(),
      useCommentsStore.persist.rehydrate(),
      useProfileStore.persist.rehydrate(),
      useBlocksStore.persist.rehydrate(),
    ]).finally(() => {
      setCachesReady(true);
    });
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
    if (!cachesReady) {
      return;
    }

    setSessionUserId(userId);

    if (userId) {
      fetchProfile(userId, accessToken);
      if (accessToken) {
        void fetchBlocks(accessToken);
      }
      return;
    }

    clearMySpots();
    clearLikedSpots();
    clearReportedSpotIds();
    clearProfile();
    clearBlocks();
  }, [cachesReady, clearBlocks, clearLikedSpots, clearMySpots, clearReportedSpotIds, fetchBlocks, setSessionUserId, userId, accessToken, fetchProfile, clearProfile]);

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

          if (isRecoveryLink) {
            router.replace('/update-password');
          }
        })
        .catch((error: unknown) => {
          if (isRecoveryLink) {
            router.replace({
              pathname: '/forgot-password',
              params: { resetError: 'expired' },
            });
          }

          showAuthNotice({
            kind: 'error',
            message: toUserFacingError(
              error,
              'Could not finish logging in. Please try again.'
            ),
          });
        });
    };

    // Handle both a cold-start email link and an app that is already open.
    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) =>
      handleUrl(url)
    );

    return () => subscription.remove();
  }, [router, setSessionFromUrl, showAuthNotice]);

  // The app is ready to decide on routing once fonts are loaded, the persisted
  // session has been restored, and (if signed in) the profile has resolved.
  const fontsReady = fontsLoaded || !!fontError;
  const sessionReady = !authInitializing;
  const profileReady = !userId || profileLoaded;
  const profileBlocked = Boolean(userId && profileError);
  const appReady = fontsReady && sessionReady && profileReady && cachesReady;

  // Signed-in users without a username stay on onboarding until they pick one
  // and agree. Users who already have a username but have not accepted the
  // current Terms stay on accept-legal. Anonymous browsing is unchanged. Legal
  // documents stay reachable. Delete-account OTP stays reachable during
  // accept-legal.
  const legalGate = getLegalGate({
    userId,
    profileLoaded,
    profile,
  });
  const routeRoot = segments[0];
  const leavingAuthEntry = shouldLeaveAuthEntryRoute({
    userId,
    legalGate,
    passwordRecovery,
    routeRoot,
  });
  const routeSettled =
    isSettledLegalRoute(legalGate, routeRoot) && !leavingAuthEntry;
  const bootSteps = [
    fontsReady,
    sessionReady,
    cachesReady,
    !profileBlocked && profileReady,
    !profileBlocked && routeSettled,
  ];
  const startupProgress = bootSteps.filter(Boolean).length / bootSteps.length;

  useEffect(() => {
    if (!appReady) {
      return;
    }

    const redirect = legalGateRedirectPath(legalGate);
    if (redirect && !isAllowedDuringLegalGate(legalGate, routeRoot)) {
      router.replace(redirect);
      return;
    }

    if (leavingAuthEntry) {
      router.replace('/');
      return;
    }

    if (
      legalGate === 'none' &&
      (routeRoot === 'onboarding' || routeRoot === 'accept-legal')
    ) {
      router.replace('/');
    }
  }, [appReady, leavingAuthEntry, legalGate, routeRoot, router]);

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
    <AnalyticsProvider>
      <PostHogErrorBoundary fallback={RootErrorFallback}>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          contentStyle: { backgroundColor: colors.surface },
        }}
        screenLayout={({ children }) => (
          <FocusedTouchGate>{children}</FocusedTouchGate>
        )}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="age-gate" />
        <Stack.Screen name="age-restricted" />
        <Stack.Screen name="accept-legal" />
        <Stack.Screen name="legal" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="user/[userId]" />
        <Stack.Screen name="follow-list" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="blocked-accounts" />
        <Stack.Screen name="help" />
        <Stack.Screen name="change-username" />
        <Stack.Screen name="edit-bio" />
        <Stack.Screen name="change-password" />
        <Stack.Screen
          name="signup"
          options={{ animationTypeForReplace: 'pop' }}
        />
        <Stack.Screen
          name="login"
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
        <Stack.Screen name="request-spot-removal" options={{ contentStyle: { backgroundColor: colors.surface } }} />
        <Stack.Screen name="report-comment" options={{ contentStyle: { backgroundColor: colors.surface } }} />
        <Stack.Screen name="spot-comments" options={{ contentStyle: { backgroundColor: colors.surface } }} />
      </Stack>

      {!appReady || !routeSettled ? (
        <StartupLoadingOverlay
          progress={startupProgress}
          logoWidth={splashLogoWidth}
          logoHeight={splashLogoHeight}
          errorBannerTop={insets.top + 12}
          profileError={userId ? profileError : null}
          profileLoading={profileLoading}
          onSignOut={() => {
            void signOut()
              .catch(() => {
                // Local session is cleared in signOut even if this rejects.
              })
              .finally(() => {
                router.replace('/');
              });
          }}
          onRetryProfile={() => {
            if (userId) {
              fetchProfile(userId, accessToken);
            }
          }}
        />
      ) : null}
      <AuthNoticeBanner />
        </GestureHandlerRootView>
      </PostHogErrorBoundary>
    </AnalyticsProvider>
  );
}

export default Sentry.wrap(RootLayout);
