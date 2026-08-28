import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../lib/navigationGuard';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { useAuthNoticeStore } from '../store/authNoticeStore';
import FeedbackPressable from './FeedbackPressable';

const SUCCESS_DISMISS_MS = 3000;

export default function AuthNoticeBanner() {
  const insets = useSafeAreaInsets();
  const router = useGuardedRouter();
  const notice = useAuthNoticeStore((state) => state.notice);
  const clearAuthNotice = useAuthNoticeStore((state) => state.clearAuthNotice);

  useEffect(() => {
    if (notice?.kind !== 'success') {
      return;
    }

    const timeout = setTimeout(() => {
      clearAuthNotice();
    }, SUCCESS_DISMISS_MS);

    return () => clearTimeout(timeout);
  }, [clearAuthNotice, notice]);

  if (!notice) {
    return null;
  }

  const isError = notice.kind === 'error';

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 z-[100] px-6"
      style={{ top: insets.top + 12 }}
    >
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        accessibilityLabel={`${notice.title}. ${notice.message}`}
        className={`flex-row items-start rounded-2xl border p-3.5 ${
          isError
            ? 'border-errorBorder bg-errorSurface'
            : 'border-border-soft bg-field'
        }`}
      >
        <View
          className={`h-10 w-10 items-center justify-center rounded-xl ${
            isError ? 'bg-white' : 'bg-accent'
          }`}
        >
          <Ionicons
            name={isError ? 'cloud-offline-outline' : 'checkmark'}
            size={18}
            color={isError ? colors.errorText : colors.brand}
          />
        </View>

        <View className="ml-3 min-w-0 flex-1">
          <Text className="font-outfit-bold text-base text-ink">
            {notice.title}
          </Text>
          <Text className="mt-0.5 font-outfit-medium text-sm leading-5 text-muted">
            {notice.message}
          </Text>

          {isError ? (
            <FeedbackPressable
              haptic="light"
              onPress={() => {
                clearAuthNotice();
                router.push('/login');
              }}
              className="mt-3 self-start rounded-xl bg-accent px-4 py-2"
              accessibilityRole="button"
              accessibilityLabel="Log in"
            >
              <Text className="font-outfit-bold text-sm text-brand">Log in</Text>
            </FeedbackPressable>
          ) : null}
        </View>

        <FeedbackPressable
          haptic="selection"
          onPress={clearAuthNotice}
          className="-mr-1 -mt-1 h-8 w-8 items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel="Dismiss notice"
        >
          <Ionicons name="close" size={16} color={colors.muted} />
        </FeedbackPressable>
      </View>
    </View>
  );
}
