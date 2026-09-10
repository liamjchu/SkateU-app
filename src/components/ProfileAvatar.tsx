import { Feather } from '@expo/vector-icons';
import { useEffect, useId } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../constants/colors';
import { displayableAvatarUrl } from '../lib/avatarUrl';
import {
  XP_PRO_RING_COLORS,
  XP_RANK_RING_COLORS,
  avatarOuterSize,
  avatarRingWidth,
  type XpRank,
} from '../lib/xpRank';
import CachedRemoteImage from './CachedRemoteImage';

type ProfileAvatarProps = {
  uri?: string | null;
  size: number;
  iconSize?: number;
  rank?: XpRank | null;
};

function RankRing({
  size,
  rank,
  animate,
}: {
  size: number;
  rank: XpRank;
  animate: boolean;
}) {
  const gradientId = useId().replace(/:/g, '');
  const outer = avatarOuterSize(size);
  const stroke = avatarRingWidth(size);
  const radius = (outer - stroke) / 2;
  const reducedMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (!animate || reducedMotion || rank !== 'pro') {
      rotation.value = 0;
      return;
    }
    rotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
  }, [animate, rank, reducedMotion, rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const ring = (
    <Svg width={outer} height={outer}>
      {rank === 'pro' ? (
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {XP_PRO_RING_COLORS.map((color, index) => (
              <Stop
                key={color}
                offset={`${(index / (XP_PRO_RING_COLORS.length - 1)) * 100}%`}
                stopColor={color}
              />
            ))}
          </LinearGradient>
        </Defs>
      ) : null}
      <Circle
        cx={outer / 2}
        cy={outer / 2}
        r={radius}
        fill="none"
        stroke={rank === 'pro' ? `url(#${gradientId})` : XP_RANK_RING_COLORS[rank]}
        strokeWidth={stroke}
      />
    </Svg>
  );

  if (rank === 'pro' && animate && !reducedMotion) {
    return <Animated.View style={spinStyle}>{ring}</Animated.View>;
  }

  return ring;
}

export default function ProfileAvatar({
  uri,
  size,
  iconSize,
  rank = null,
}: ProfileAvatarProps) {
  const displayUri = displayableAvatarUrl(uri);
  const glyphSize = iconSize ?? Math.max(12, Math.round(size * 0.45));
  const radius = size / 2;
  const showRing = rank != null;
  const outer = showRing ? avatarOuterSize(size) : size;

  return (
    <View
      className="items-center justify-center"
      style={{ width: outer, height: outer }}
    >
      {showRing ? (
        <View style={{ position: 'absolute', top: 0, left: 0 }}>
          <RankRing size={size} rank={rank} animate={size >= 64} />
        </View>
      ) : null}
      <View
        className="items-center justify-center overflow-hidden bg-accent"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
        }}
      >
        {displayUri ? (
          <CachedRemoteImage
            uri={displayUri}
            style={{ width: size, height: size, borderRadius: radius }}
          />
        ) : (
          <Feather name="user" size={glyphSize} color={colors.brand} />
        )}
      </View>
    </View>
  );
}
