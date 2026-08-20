import { useState } from 'react';
import {
    Image,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    View,
} from 'react-native';
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

  if (uris.length === 0) {
    return null;
  }

  const pageWidth = width > 0 ? width : 1;

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
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {uris.length === 1 ? (
        <FeedbackPressable
          haptic="light"
          disablePressScale
          onPress={() => onPressIndex(0)}
          accessibilityRole="button"
          accessibilityLabel={`View full screen photo of ${accessibilityName}`}
          accessibilityHint="Opens the photo. Pinch or double tap to zoom."
        >
          <Image
            source={{ uri: uris[0] }}
            style={{ height }}
            className={`w-full bg-surface-soft ${imageClassName ?? ''}`}
            resizeMode="cover"
            accessible={false}
          />
        </FeedbackPressable>
      ) : width === 0 ? (
        <View style={{ height }} className="bg-surface-soft" />
      ) : (
        <View style={{ height }}>
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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
                accessibilityHint="Opens the photo. Pinch or double tap to zoom."
              >
                <Image
                  source={{ uri }}
                  style={{ width: pageWidth, height }}
                  className={`bg-surface-soft ${imageClassName ?? ''}`}
                  resizeMode="cover"
                  accessible={false}
                />
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
