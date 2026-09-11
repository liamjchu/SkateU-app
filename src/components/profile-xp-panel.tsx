import { Text, View } from 'react-native';
import { formatXpToNextLabel, rankProgress } from '../lib/xpRank';

type ProfileXpPanelProps = {
  xpTotal: number;
};

export default function ProfileXpPanel({ xpTotal }: ProfileXpPanelProps) {
  const progress = rankProgress(xpTotal);
  const progressLabel = formatXpToNextLabel(xpTotal);

  return (
    <View className="mt-4 w-full">
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={progressLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        className="h-1.5 overflow-hidden rounded-full bg-surface-soft"
      >
        <View
          className="h-1.5 rounded-full bg-accent"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </View>
      <Text className="mt-1.5 font-outfit-medium text-sm text-muted">
        {progressLabel}
      </Text>
    </View>
  );
}
