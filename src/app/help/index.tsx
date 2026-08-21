import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import FeedbackPressable from '../../components/FeedbackPressable';
import ScreenHeader from '../../components/screen-header';
import { colors } from '../../constants/colors';

type HelpRow = {
  href: Href;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
};

const HELP_ROWS: HelpRow[] = [
  {
    href: '/help/contact',
    icon: 'mail',
    title: 'Contact SkateU',
    subtitle: 'Questions, feedback, partnerships, or anything else.',
  },
  {
    href: '/help/bug',
    icon: 'alert-circle',
    title: 'Report a Bug',
    subtitle: 'Something isn’t working correctly.',
  },
  {
    href: '/help/feature',
    icon: 'star',
    title: 'Suggest a Feature',
    subtitle: 'Have an idea for SkateU?',
  },
  {
    href: '/help/spot-problem',
    icon: 'map-pin',
    title: 'Report a Problem with a Spot',
    subtitle: 'Something is wrong with a specific spot.',
  },
];

export default function HelpSupportScreen() {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/settings');
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Help & Support" onBack={goBack} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="self-center w-full max-w-[640px] px-6 pb-8 pt-6"
        showsVerticalScrollIndicator={false}
      >
        <Text className="font-outfit-black text-2xl text-ink">Help & Support</Text>
        <Text className="mt-2 mb-6 font-outfit-medium text-base text-muted">
          Need help or want to tell us something?
        </Text>

        <View className="overflow-hidden rounded-2xl bg-field">
          {HELP_ROWS.map((row, index) => (
            <View key={row.title}>
              {index > 0 ? <View className="ml-16 h-px bg-border-soft" /> : null}
              <FeedbackPressable
                haptic="selection"
                onPress={() => router.push(row.href)}
                pressLockMs={700}
                className="min-h-16 flex-row items-center px-4 py-4"
                accessibilityRole="button"
                accessibilityLabel={row.title}
                accessibilityHint={row.subtitle}
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-soft">
                  <Feather name={row.icon} size={16} color={colors.ink} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-outfit-semibold text-base text-ink">
                    {row.title}
                  </Text>
                  <Text className="mt-0.5 font-outfit-medium text-sm text-muted">
                    {row.subtitle}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.muted} />
              </FeedbackPressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
