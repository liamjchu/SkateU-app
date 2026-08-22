import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { SOCIAL_LINKS, type SocialPlatformId } from '../constants/social';
import { openSocialUrl } from '../lib/socialLinks';
import FeedbackPressable from './FeedbackPressable';

const SOCIAL_ICONS: Record<SocialPlatformId, keyof typeof Ionicons.glyphMap> = {
  instagram: 'logo-instagram',
  tiktok: 'logo-tiktok',
  youtube: 'logo-youtube',
};

type SocialLinksProps = {
  showCaption?: boolean;
};

export default function SocialLinks({ showCaption = false }: SocialLinksProps) {
  return (
    <View>
      {showCaption ? (
        <Text className="mb-3 text-center font-outfit-semibold text-sm text-muted">
          Follow SkateU
        </Text>
      ) : null}
      <View
        className="flex-row items-center justify-center gap-2"
        accessibilityLabel="Follow SkateU on social media"
      >
        {SOCIAL_LINKS.map((link) => (
          <FeedbackPressable
            key={link.id}
            haptic="selection"
            onPress={() => {
              void openSocialUrl(link.url);
            }}
            className="h-11 w-11 items-center justify-center rounded-full border border-brand/40"
            accessibilityRole="link"
            accessibilityLabel={link.accessibilityLabel}
          >
            <Ionicons
              name={SOCIAL_ICONS[link.id]}
              size={20}
              color={colors.brand}
            />
          </FeedbackPressable>
        ))}
      </View>
    </View>
  );
}
