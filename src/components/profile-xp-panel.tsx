import { useState } from 'react';
import { Text, View } from 'react-native';
import { colors } from '../constants/colors';
import {
  XP_RANK_LABELS,
  rankFromXp,
  rankProgress,
  xpToNextRank,
} from '../lib/xpRank';
import type { XpEventView } from '../types/xp';
import FeedbackPressable from './FeedbackPressable';

const VISIBLE_EVENT_COUNT = 5;

type ProfileXpPanelProps = {
  xpTotal: number;
  events: XpEventView[];
};

export default function ProfileXpPanel({ xpTotal, events }: ProfileXpPanelProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const rank = rankFromXp(xpTotal);
  const upcoming = xpToNextRank(xpTotal);
  const progress = rankProgress(xpTotal);
  const progressLabel = upcoming
    ? `${upcoming.remaining} XP to ${XP_RANK_LABELS[upcoming.next]}`
    : 'Pro';
  const visibleEvents = events.slice(0, VISIBLE_EVENT_COUNT);
  const canToggleHistory = visibleEvents.length > 0;

  const summary = (
    <View>
      <Text className="text-center font-outfit-medium text-sm text-muted">
        {XP_RANK_LABELS[rank]} · {xpTotal} XP
      </Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={progressLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-soft"
      >
        <View
          className="h-1.5 rounded-full bg-accent"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </View>
    </View>
  );

  return (
    <View className="mt-2 w-full">
      {canToggleHistory ? (
        <FeedbackPressable
          haptic="selection"
          onPress={() => setHistoryOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: historyOpen }}
          accessibilityLabel={`${XP_RANK_LABELS[rank]}, ${xpTotal} XP. ${progressLabel}`}
          accessibilityHint={
            historyOpen ? 'Hide recent XP' : 'Show recent XP'
          }
        >
          {summary}
        </FeedbackPressable>
      ) : (
        summary
      )}

      {historyOpen ? (
        <View className="mt-3">
          {visibleEvents.map((event) => (
            <Text
              key={event.id}
              className="py-0.5 text-center font-outfit-medium text-xs text-muted"
              style={{ color: event.delta > 0 ? colors.ink : colors.muted }}
            >
              {event.summary}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
