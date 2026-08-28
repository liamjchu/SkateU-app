import { Feather } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { colors } from '../constants/colors';
import FeedbackPressable from './FeedbackPressable';
import LegalDocumentLinks from './legal-document-links';

type LegalAcceptCheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
};

export default function LegalAcceptCheckbox({
  checked,
  onCheckedChange,
  disabled = false,
}: LegalAcceptCheckboxProps) {
  return (
    <View>
      <Text className="mb-2 px-1 font-outfit-bold text-xs uppercase tracking-wide text-muted">
        Required reading
      </Text>
      <LegalDocumentLinks />

      <FeedbackPressable
        haptic="selection"
        onPress={() => onCheckedChange(!checked)}
        disabled={disabled}
        className="mt-4 min-h-14 flex-row items-center rounded-2xl border border-border-soft bg-field px-4 py-3"
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel="Agree to SkateU Terms, Community Guidelines, Privacy Policy, that SkateU may feature spots you post on Instagram, TikTok, and YouTube, and that you are 13 or older"
      >
        <View
          className={`h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
            checked ? 'border-accent bg-accent' : 'border-border-soft bg-surface'
          }`}
        >
          {checked ? (
            <Feather name="check" size={16} color={colors.brand} />
          ) : null}
        </View>
        <Text className="ml-3 min-w-0 flex-1 font-outfit-medium text-base leading-6 text-ink">
          I agree, including that SkateU may feature spots I post on Instagram,
          TikTok, and YouTube. I am 13 or older.
        </Text>
      </FeedbackPressable>
    </View>
  );
}
