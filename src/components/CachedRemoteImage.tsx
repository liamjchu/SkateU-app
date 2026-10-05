import { Feather } from '@expo/vector-icons';
import { Image, type ImageProps } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../constants/colors';

type CachedRemoteImageProps = {
  uri: string;
  className?: string;
  style?: ImageProps['style'];
  contentFit?: ImageProps['contentFit'];
  priority?: ImageProps['priority'];
  accessible?: boolean;
};

export default function CachedRemoteImage({
  uri,
  className,
  style,
  contentFit = 'cover',
  priority = 'normal',
  accessible = false,
}: CachedRemoteImageProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setStatus('loading');
  }, [uri]);

  return (
    <View className={`overflow-hidden ${className ?? ''}`} style={style}>
      <Image
        source={{ uri }}
        recyclingKey={uri}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        cachePolicy="memory-disk"
        priority={priority}
        accessible={accessible}
        onLoad={() => setStatus('ready')}
        onError={() => setStatus('error')}
        onDisplay={() => setStatus('ready')}
      />
      {status === 'ready' ? null : (
        <View className="absolute inset-0 z-10 items-center justify-center bg-surface-soft">
          {status === 'error' ? (
            <Feather name="image" size={22} color={colors.muted} />
          ) : (
            <ActivityIndicator
              color={colors.accent}
              accessibilityLabel="Loading photo"
            />
          )}
        </View>
      )}
    </View>
  );
}
