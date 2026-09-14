import { Text, View } from 'react-native';
import { useFontScale } from '../hooks/useFontScale';
import FeedbackPressable from './FeedbackPressable';

type SupportChoice<T extends string> = {
  value: T;
  label: string;
};

type SupportChoiceListProps<T extends string> = {
  options: SupportChoice<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
};

export default function SupportChoiceList<T extends string>({
  options,
  value,
  onChange,
  error,
}: SupportChoiceListProps<T>) {
  const { isLarge } = useFontScale();

  return (
    <View>
      <View className="overflow-hidden rounded-2xl bg-field">
        {options.map((option, index) => {
          const selected = value === option.value;
          return (
            <FeedbackPressable
              key={option.value}
              haptic="selection"
              onPress={() => onChange(option.value)}
              className={`min-h-14 flex-row px-4 py-3 ${
                isLarge ? 'items-start' : 'items-center'
              } ${index > 0 ? 'border-t border-border-soft' : ''}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
            >
              <View
                className={`h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  isLarge ? 'mt-0.5' : ''
                } ${
                  selected ? 'border-accent bg-accent' : 'border-border-soft bg-field'
                }`}
              >
                {selected ? <View className="h-2 w-2 rounded-full bg-brand" /> : null}
              </View>
              <Text className="ml-3 min-w-0 flex-1 font-outfit-semibold text-base text-ink">
                {option.label}
              </Text>
            </FeedbackPressable>
          );
        })}
      </View>
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
