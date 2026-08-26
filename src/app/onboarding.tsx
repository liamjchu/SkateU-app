import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from '../components/FeedbackPressable';
import LegalAcceptCheckbox from '../components/legal-accept-checkbox';
import KeyboardShiftView from '../components/keyboard-shift-view';
import { UsernameForm } from '../components/username-form';
import { StickerStripe } from '../components/sticker';
import { canAcceptLegalTerms } from '../lib/legalAcceptance';
import { slugifyUsername } from '../lib/username';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.session?.access_token);
  const signOut = useAuthStore((state) => state.signOut);
  const acceptLegal = useProfileStore((state) => state.acceptLegal);
  const clearProfile = useProfileStore((state) => state.clearProfile);
  const [agreed, setAgreed] = useState(false);

  const suggestedUsername = useMemo(() => {
    const meta = user?.user_metadata;
    const rawName =
      typeof meta?.full_name === 'string'
        ? meta.full_name
        : typeof meta?.name === 'string'
          ? meta.name
          : '';
    return slugifyUsername(rawName);
  }, [user]);

  const handleSignOut = async () => {
    try {
      clearProfile();
      await signOut();
    } catch {
      // The auth listener will settle state if sign-out cannot complete here.
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <View className="bg-brand">
        <View
          className="px-6 pb-4"
          style={{
            paddingTop: insets.top + 16,
          }}
        >
          <Text
            className="font-outfit-bold text-2xl text-white"
            numberOfLines={1}
          >
            Choose a username
          </Text>
        </View>
        <StickerStripe />
      </View>

      <KeyboardShiftView
        closedBottomPadding={Math.max(insets.bottom, 24) + 16}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow"
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 24) + 16,
          }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={false}
          showsVerticalScrollIndicator={false}
        >
          <View className="w-full max-w-[640px] self-center px-6 pt-8">
            <Text className="font-outfit-black text-2xl leading-8 text-ink">
              One last step
            </Text>
            <Text className="mt-2 font-outfit-medium text-base leading-6 text-muted">
              Pick a unique username. This is how other skaters will see you —
              your email stays private.
            </Text>
            <UsernameForm
              initialUsername={suggestedUsername}
              submitLabel="Continue"
              submittingLabel="Saving…"
              showWelcomeOnSave
              submitEnabled={canAcceptLegalTerms(agreed)}
              onBeforeSubmit={async () => {
                if (!agreed) {
                  throw new Error(
                    'Confirm you are at least 13 and agree before continuing.'
                  );
                }
                if (!accessToken) {
                  throw new Error('Sign in again to keep going.');
                }
                await acceptLegal(accessToken);
              }}
              footer={
                <LegalAcceptCheckbox
                  checked={agreed}
                  onCheckedChange={setAgreed}
                />
              }
              onSaved={() => undefined}
            />
            <FeedbackPressable
              onPress={handleSignOut}
              className="mt-8 min-h-12 items-center justify-center py-4"
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Text className="font-outfit-semibold text-base text-muted">
                Sign out
              </Text>
            </FeedbackPressable>
          </View>
        </ScrollView>
      </KeyboardShiftView>
    </View>
  );
}
