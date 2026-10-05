import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    View,
} from 'react-native';
import { colors } from '../constants/colors';
import { shouldMountPagerImage } from '../lib/spotMediaPager';
import CachedRemoteImage from './CachedRemoteImage';
import FeedbackPressable from './FeedbackPressable';

type SpotMediaPagerProps = {
  uris: string[];
  height: number;
  onPressIndex: (index: number) => void;
  accessibilityName: string;
  imageClassName?: string;
};

export default function SpotMediaPager({
  uris,
  height,
  onPressIndex,
  accessibilityName,
  imageClassName,
}: SpotMediaPagerProps) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex((current) =>
      Math.min(current, Math.max(uris.length - 1, 0))
    );
  }, [uris.length]);

  const prefetchKey = uris.join('\n');
  useEffect(() => {
    if (!prefetchKey) {
      return;
    }
    void Image.prefetch(prefetchKey.split('\n'), 'memory-disk');
  }, [prefetchKey]);

  if (uris.length === 0) {
    return null;
  }

  const firstUri = uris[0];
  const pageWidth = width > 0 ? width : 1;

  if (!firstUri) {
    return null;
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (pageWidth <= 1) {
      return;
    }

    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (next !== index && next >= 0 && next < uris.length) {
      setIndex(next);
    }
  }

  return (
    <View
      style={{ height }}
      className="overflow-hidden"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width === 0 ? (
        <View
          style={{ height }}
          className="items-center justify-center bg-surface-soft"
        >
          <ActivityIndicator
            color={colors.accent}
            accessibilityLabel="Loading photo"
          />
        </View>
      ) : uris.length === 1 ? (
        <FeedbackPressable
          haptic="light"
          disablePressScale
          onPress={() => onPressIndex(0)}
          accessibilityRole="button"
          accessibilityLabel={`Open full screen view of ${accessibilityName}`}
          accessibilityHint="Opens the full screen spot view. Pinch or double tap to zoom."
        >
          <CachedRemoteImage
            uri={firstUri}
            priority="high"
            style={{ width, height }}
            className={`bg-surface-soft ${imageClassName ?? ''}`}
            accessible={false}
          />
        </FeedbackPressable>
      ) : (
        <View style={{ height }}>
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            onMomentumScrollEnd={handleScroll}
            scrollEventThrottle={16}
          >
            {uris.map((uri, photoIndex) => (
              <FeedbackPressable
                key={`${uri}-${photoIndex}`}
                haptic="light"
                disablePressScale
                onPress={() => onPressIndex(photoIndex)}
                style={{ width: pageWidth, height }}
                accessibilityRole="button"
                accessibilityLabel={`Photo ${photoIndex + 1} of ${uris.length} of ${accessibilityName}`}
                accessibilityHint="Opens the full screen spot view. Pinch or double tap to zoom."
              >
                {shouldMountPagerImage(photoIndex, index) ? (
                  <CachedRemoteImage
                    uri={uri}
                    priority={photoIndex === index ? 'high' : 'low'}
                    style={{ width: pageWidth, height }}
                    className={`bg-surface-soft ${imageClassName ?? ''}`}
                    accessible={false}
                  />
                ) : (
                  <View
                    style={{ width: pageWidth, height }}
                    className="bg-surface-soft"
                  />
                )}
              </FeedbackPressable>
            ))}
          </ScrollView>
          <View
            pointerEvents="none"
            className="absolute bottom-2.5 left-0 right-0 flex-row items-center justify-center"
          >
            {uris.map((_, dotIndex) => (
              <View
                key={dotIndex}
                className={`mx-0.5 h-1.5 w-1.5 rounded-full ${
                  dotIndex === index ? 'bg-white' : 'bg-white/45'
                }`}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
