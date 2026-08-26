import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { colors } from '../constants/colors';
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
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex((current) =>
      Math.min(current, Math.max(uris.length - 1, 0))
    );
  }, [uris.length]);

  if (uris.length === 0) {
    return null;
  }

  const photoIndex = Math.min(index, uris.length - 1);
  const uri = uris[photoIndex];
  if (!uri) {
    return null;
  }

  function goToPhoto(next: number) {
    if (next < 0 || next >= uris.length) {
      return;
    }

    setIndex(next);
  }

  return (
    <View style={{ height }} className="overflow-hidden">
      <FeedbackPressable
        haptic="light"
        disablePressScale
        onPress={() => onPressIndex(photoIndex)}
        accessibilityRole="button"
        accessibilityLabel={
          uris.length > 1
            ? `Photo ${photoIndex + 1} of ${uris.length} of ${accessibilityName}`
            : `Open full screen view of ${accessibilityName}`
        }
        accessibilityHint="Opens the full screen spot view. Pinch or double tap to zoom."
      >
        <CachedRemoteImage
          uri={uri}
          style={{ height }}
          className={`w-full bg-surface-soft ${imageClassName ?? ''}`}
          accessible={false}
        />
      </FeedbackPressable>
      {uris.length > 1 ? (
        <>
          <FeedbackPressable
            haptic="selection"
            onPress={() => goToPhoto(photoIndex - 1)}
            disabled={photoIndex === 0}
            className="absolute left-2 top-1/2 h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45"
            accessibilityRole="button"
            accessibilityLabel="Previous photo"
          >
            <Feather
              name="chevron-left"
              size={18}
              color={photoIndex === 0 ? 'rgba(255,255,255,0.35)' : colors.white}
            />
          </FeedbackPressable>
          <FeedbackPressable
            haptic="selection"
            onPress={() => goToPhoto(photoIndex + 1)}
            disabled={photoIndex === uris.length - 1}
            className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45"
            accessibilityRole="button"
            accessibilityLabel="Next photo"
          >
            <Feather
              name="chevron-right"
              size={18}
              color={
                photoIndex === uris.length - 1
                  ? 'rgba(255,255,255,0.35)'
                  : colors.white
              }
            />
          </FeedbackPressable>
          <View
            pointerEvents="none"
            className="absolute bottom-2.5 left-0 right-0 flex-row items-center justify-center"
          >
            {uris.map((_, dotIndex) => (
              <View
                key={dotIndex}
                className={`mx-0.5 h-1.5 w-1.5 rounded-full ${
                  dotIndex === photoIndex ? 'bg-white' : 'bg-white/45'
                }`}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
