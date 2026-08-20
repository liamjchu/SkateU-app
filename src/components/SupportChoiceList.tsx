import { Text, View } from 'react-native';
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
              className={`min-h-14 flex-row items-center px-4 py-3 ${
                index > 0 ? 'border-t border-border-soft' : ''
              }`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
            >
              <View
                className={`h-5 w-5 items-center justify-center rounded-full border ${
                  selected ? 'border-accent bg-accent' : 'border-border-soft bg-field'
                }`}
              >
                {selected ? <View className="h-2 w-2 rounded-full bg-brand" /> : null}
              </View>
              <Text className="ml-3 flex-1 font-outfit-semibold text-base text-ink">
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
