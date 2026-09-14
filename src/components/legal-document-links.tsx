import { Feather } from '@expo/vector-icons';
import { useGuardedRouter } from '../lib/navigationGuard';
import { Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { useFontScale } from '../hooks/useFontScale';
import { LEGAL_APP_ROUTES } from '../lib/legalAcceptance';
import FeedbackPressable from './FeedbackPressable';

const DOCUMENTS = [
  {
    href: LEGAL_APP_ROUTES.terms,
    icon: 'file-text',
    label: 'Terms of Use',
  },
  {
    href: LEGAL_APP_ROUTES.communityGuidelines,
    icon: 'users',
    label: 'Community Guidelines',
  },
  {
    href: LEGAL_APP_ROUTES.privacy,
    icon: 'shield',
    label: 'Privacy Policy',
  },
] as const;

export default function LegalDocumentLinks() {
  const router = useGuardedRouter();
  const { isLarge } = useFontScale();

  return (
    <View className="overflow-hidden rounded-2xl bg-field">
      {DOCUMENTS.map((document, index) => (
        <View key={document.href}>
          {index > 0 ? <View className="ml-16 h-px bg-border-soft" /> : null}
          <FeedbackPressable
            haptic="selection"
            onPress={() => router.push(document.href)}
            className={`min-h-14 flex-row px-4 py-3 ${
              isLarge ? 'items-start' : 'items-center'
            }`}
            accessibilityRole="link"
            accessibilityLabel={document.label}
          >
            <View
              className={`h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-soft ${
                isLarge ? 'mt-0.5' : ''
              }`}
            >
              <Feather name={document.icon} size={16} color={colors.ink} />
            </View>
            <Text className="ml-3 min-w-0 flex-1 font-outfit-semibold text-base text-ink">
              {document.label}
            </Text>
            <Feather
              name="chevron-right"
              size={18}
              color={colors.muted}
              style={isLarge ? { marginTop: 8 } : undefined}
            />
          </FeedbackPressable>
        </View>
      ))}
    </View>
  );
}
