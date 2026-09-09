import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { XP_RANK_LABELS } from '../lib/xpRank';
import { useProfileStore } from '../store/profileStore';
import { useXpFeedbackStore } from '../store/xpFeedbackStore';
import FeedbackPressable from './FeedbackPressable';
import ProfileAvatar from './ProfileAvatar';

const DISMISS_MS = 4200;

export default function XpRankUpOverlay() {
  const rankUp = useXpFeedbackStore((state) => state.rankUp);
  const clearRankUp = useXpFeedbackStore((state) => state.clearRankUp);
  const avatarUrl = useProfileStore((state) => state.profile?.avatar_url ?? null);

  useEffect(() => {
    if (!rankUp) {
      return;
    }

    const timeout = setTimeout(() => {
      clearRankUp();
    }, DISMISS_MS);

    return () => clearTimeout(timeout);
  }, [clearRankUp, rankUp]);

  if (!rankUp) {
    return null;
  }

  const label = XP_RANK_LABELS[rankUp.rank];

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-0 z-[120] items-center justify-center px-8"
    >
      <FeedbackPressable
        haptic="selection"
        onPress={clearRankUp}
        disablePressScale
        className="absolute inset-0 bg-brand/40"
        accessibilityRole="button"
        accessibilityLabel="Dismiss rank up"
      />
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        accessibilityLabel={`You’re a ${label} now`}
        className="w-full max-w-[320px] items-center rounded-3xl border border-border-soft bg-field px-6 py-8"
      >
        <ProfileAvatar uri={avatarUrl} size={96} iconSize={40} rank={rankUp.rank} />
        <Text className="mt-5 text-center font-outfit-black text-2xl text-ink">
          You’re a {label} now
        </Text>
        <Text className="mt-2 text-center font-outfit-medium text-sm leading-5 text-muted">
          Keep adding spots people actually skate.
        </Text>
        <FeedbackPressable
          haptic="light"
          onPress={clearRankUp}
          className="mt-5 rounded-2xl bg-accent px-5 py-3"
          accessibilityRole="button"
          accessibilityLabel="Nice"
        >
          <Text className="font-outfit-bold text-sm text-brand">Nice</Text>
        </FeedbackPressable>
      </View>
    </View>
  );
}
