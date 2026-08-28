import { useGuardedRouter } from '../lib/navigationGuard';
import { Text } from 'react-native';
import { LEGAL_APP_ROUTES } from '../lib/legalAcceptance';

type SpotSocialNoticeProps = {
  action: 'posting' | 'saving';
};

export default function SpotSocialNotice({ action }: SpotSocialNoticeProps) {
  const router = useGuardedRouter();
  const lead =
    action === 'saving'
      ? 'By saving, you let SkateU feature this spot on Instagram, TikTok, and YouTube.'
      : 'By posting, you let SkateU feature this spot on Instagram, TikTok, and YouTube.';

  return (
    <Text className="mt-4 text-center font-outfit-medium text-sm leading-5 text-muted">
      {lead}{' '}
      <Text
        className="font-outfit-semibold text-ink underline"
        onPress={() => router.push(LEGAL_APP_ROUTES.terms)}
        accessibilityRole="link"
        accessibilityLabel="Terms of Use"
      >
        Terms of Use
      </Text>
    </Text>
  );
}
