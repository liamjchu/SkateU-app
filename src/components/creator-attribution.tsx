import { useGuardedRouter } from '../lib/navigationGuard';
import { Text, type TextProps } from 'react-native';
import { openUserProfile } from '../lib/userProfileNavigation';
import { useAuthStore } from '../store/authStore';

type CreatorAttributionProps = {
  userId?: string | null;
  username?: string | null;
  fallback: string;
  suffix?: string;
  className?: string;
  numberOfLines?: number;
  accessibilityLabel?: string;
} & Pick<TextProps, 'style'>;

export default function CreatorAttribution({
  userId,
  username,
  fallback,
  suffix = '',
  className,
  numberOfLines,
  accessibilityLabel,
  style,
}: CreatorAttributionProps) {
  const router = useGuardedRouter();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const label = username ? `@${username}` : fallback;
  const canOpen = Boolean(userId);

  if (!canOpen || !userId) {
    return (
      <Text className={className} numberOfLines={numberOfLines} style={style}>
        {`${label}${suffix}`}
      </Text>
    );
  }

  return (
    <Text className={className} numberOfLines={numberOfLines} style={style}>
      <Text
        onPress={() => {
          openUserProfile(router, userId, currentUserId);
        }}
        accessibilityRole="link"
        accessibilityLabel={accessibilityLabel ?? `Open ${label}'s profile`}
        className={className}
      >
        {label}
      </Text>
      {suffix}
    </Text>
  );
}
