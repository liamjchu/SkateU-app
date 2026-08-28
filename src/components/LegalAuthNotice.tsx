import { useGuardedRouter } from '../lib/navigationGuard';
import { Text, View } from 'react-native';
import { LEGAL_APP_ROUTES } from '../lib/legalAcceptance';
import FeedbackPressable from './FeedbackPressable';

const LINKS = [
  { href: LEGAL_APP_ROUTES.terms, label: 'Terms of Use' },
  {
    href: LEGAL_APP_ROUTES.communityGuidelines,
    label: 'Community Guidelines',
  },
  { href: LEGAL_APP_ROUTES.privacy, label: 'Privacy Policy' },
] as const;

export default function LegalAuthNotice() {
  const router = useGuardedRouter();

  return (
    <View className="mt-6">
      <Text className="text-center font-outfit-medium text-sm leading-5 text-muted">
        By continuing, you agree to SkateU’s terms. You must be 13 or older.
      </Text>
      <View className="mt-3 flex-row flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {LINKS.map((link) => (
          <FeedbackPressable
            key={link.href}
            onPress={() => router.push(link.href)}
            className="min-h-10 items-center justify-center py-1"
            accessibilityRole="link"
            accessibilityLabel={link.label}
          >
            <Text className="font-outfit-semibold text-sm text-ink underline">
              {link.label}
            </Text>
          </FeedbackPressable>
        ))}
      </View>
    </View>
  );
}
