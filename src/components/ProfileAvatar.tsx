import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';
import { colors } from '../constants/colors';
import { displayableAvatarUrl } from '../lib/avatarUrl';
import CachedRemoteImage from './CachedRemoteImage';

type ProfileAvatarProps = {
  uri?: string | null;
  size: number;
  iconSize?: number;
  tone?: 'default' | 'onDark' | 'onLight';
};

export default function ProfileAvatar({
  uri,
  size,
  iconSize,
  tone = 'default',
}: ProfileAvatarProps) {
  const displayUri = displayableAvatarUrl(uri);
  const glyphSize = iconSize ?? Math.max(12, Math.round(size * 0.45));
  const radius = size / 2;
  const onDark = tone === 'onDark';
  const backgroundClass =
    tone === 'onDark' ? 'bg-white/15' : tone === 'onLight' ? 'bg-white' : 'bg-accent';

  return (
    <View
      className={`items-center justify-center overflow-hidden ${backgroundClass}`}
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
        <Feather
          name="user"
          size={glyphSize}
          color={onDark ? colors.white : colors.brand}
        />
      )}
    </View>
  );
}
