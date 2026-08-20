import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { colors } from '../constants/colors';
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
  const router = useRouter();

  return (
    <View className="overflow-hidden rounded-2xl bg-field">
      {DOCUMENTS.map((document, index) => (
        <View key={document.href}>
          {index > 0 ? <View className="ml-16 h-px bg-border-soft" /> : null}
          <FeedbackPressable
            haptic="selection"
            onPress={() => router.push(document.href)}
            className="min-h-14 flex-row items-center px-4 py-3"
            accessibilityRole="link"
            accessibilityLabel={document.label}
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-soft">
              <Feather name={document.icon} size={16} color={colors.ink} />
            </View>
            <Text
              className="ml-3 min-w-0 flex-1 font-outfit-semibold text-base text-ink"
              numberOfLines={1}
            >
              {document.label}
            </Text>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </FeedbackPressable>
        </View>
      ))}
    </View>
  );
}
