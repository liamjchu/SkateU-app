import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import FeedbackPressable from './FeedbackPressable';
import KeyboardShiftView from './keyboard-shift-view';
import ScreenHeader from './screen-header';

type SupportFormShellProps = {
  title: string;
  submitting: boolean;
  submitted: boolean;
  successTitle: string;
  successMessage: string;
  submitLabel: string;
  submitDisabled?: boolean;
  submitError: string;
  onBack: () => void;
  onSubmit: () => void;
  children: ReactNode;
};

export default function SupportFormShell({
  title,
  submitting,
  submitted,
  successTitle,
  successMessage,
  submitLabel,
  submitDisabled = false,
  submitError,
  onBack,
  onSubmit,
  children,
}: SupportFormShellProps) {
  const disabled = submitting || submitDisabled;

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={{ flex: 1, backgroundColor: colors.surface }}
    >
      <ScreenHeader title={title} onBack={onBack} backDisabled={submitting} />

      <KeyboardShiftView>
        {submitted ? (
          <View className="flex-1 justify-center px-6">
            <View className="w-full max-w-[720px] self-center rounded-2xl bg-field p-6">
              <Text className="font-outfit-bold text-2xl text-ink">
                {successTitle}
              </Text>
              <Text className="mt-3 font-outfit-medium text-base text-muted">
                {successMessage}
              </Text>
              <FeedbackPressable
                haptic="light"
                onPress={onBack}
                className="mt-6 min-h-14 items-center justify-center rounded-2xl bg-accent px-5 py-4"
                accessibilityRole="button"
                accessibilityLabel="Done"
              >
                <Text className="font-outfit-bold text-lg text-brand">Done</Text>
              </FeedbackPressable>
            </View>
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="w-full max-w-[720px] self-center px-6 pb-10 pt-5"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets={false}
            onScrollBeginDrag={Keyboard.dismiss}
            showsVerticalScrollIndicator={false}
          >
            {children}

            {submitError ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                className="mt-4 text-center font-outfit-medium text-base text-errorText"
              >
                {submitError}
              </Text>
            ) : null}

            <FeedbackPressable
              haptic="light"
              onPress={onSubmit}
              disabled={disabled}
              className={`mt-6 min-h-14 items-center justify-center rounded-2xl px-5 py-4 ${
                disabled ? 'bg-actionDisabled' : 'bg-accent'
              }`}
              accessibilityRole="button"
              accessibilityLabel={submitting ? 'Submitting' : submitLabel}
              accessibilityState={{ disabled, busy: submitting }}
            >
              {submitting ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color={colors.muted} />
                  <Text className="ml-2 font-outfit-bold text-lg text-muted">
                    Submitting…
                  </Text>
                </View>
              ) : (
                <Text className="font-outfit-bold text-lg text-brand">
                  {submitLabel}
                </Text>
              )}
            </FeedbackPressable>
          </ScrollView>
        )}
      </KeyboardShiftView>
    </SafeAreaView>
  );
}
