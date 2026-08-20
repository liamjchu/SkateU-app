import { Text, TextInput, View } from 'react-native';
import { colors } from '../constants/colors';

type SupportMessageFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  maxLength: number;
  error: string | null;
};

export default function SupportMessageField({
  label,
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  maxLength,
  error,
}: SupportMessageFieldProps) {
  return (
    <View>
      <Text className="mb-2 font-outfit-bold text-base text-ink">{label}</Text>
      <View
        className={`rounded-2xl border bg-field px-5 py-4 ${
          error ? 'border-errorBorder' : 'border-border-soft'
        }`}
      >
        <TextInput
          className="min-h-32 w-full p-0 font-outfit-medium text-base text-ink"
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          accessibilityLabel={accessibilityLabel}
          multiline
          maxLength={maxLength}
          textAlignVertical="top"
          value={value}
          onChangeText={onChangeText}
        />
      </View>
      {value.length > maxLength * 0.8 ? (
        <Text className="mt-1 self-end font-outfit-medium text-sm tabular-nums text-muted">
          {value.length}/{maxLength}
        </Text>
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          className="mt-2 font-outfit-medium text-sm text-errorText"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
