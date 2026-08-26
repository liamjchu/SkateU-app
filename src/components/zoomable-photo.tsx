import { Image as ExpoImage } from 'expo-image';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DISMISS_DISTANCE = 120;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

const AnimatedImage = Animated.createAnimatedComponent(ExpoImage);

export type ZoomablePhotoProps = {
  uri: string;
  width: number;
  height: number;
  paging: boolean;
  onClose: () => void;
  onZoomChange: (zoomed: boolean) => void;
  accessibilityLabel: string;
};

export default function ZoomablePhoto({
  uri,
  width,
  height,
  paging,
  onClose,
  onZoomChange,
  accessibilityLabel,
}: ZoomablePhotoProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;
  const close = useCallback(() => {
    onCloseRef.current();
  }, []);
  const reportZoom = useCallback((zoomed: boolean) => {
    onZoomChangeRef.current(zoomed);
  }, []);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    reportZoom(false);
  }, [
    reportZoom,
    savedScale,
    savedTranslateX,
    savedTranslateY,
    scale,
    translateX,
    translateY,
    uri,
  ]);

  const pinch = Gesture.Pinch()
    .onTouchesMove((event, manager) => {
      'worklet';
      if (event.numberOfTouches < 2) {
        manager.fail();
      }
    })
    .onUpdate((event) => {
      'worklet';
      if (event.numberOfPointers < 2) {
        return;
      }

      scale.value = clamp(savedScale.value * event.scale, 0.85, MAX_SCALE);
    })
    .onEnd(() => {
      'worklet';
      if (scale.value < MIN_SCALE) {
        savedScale.value = MIN_SCALE;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        scale.value = withTiming(MIN_SCALE);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        runOnJS(reportZoom)(false);
        return;
      }

      savedScale.value = scale.value;
      runOnJS(reportZoom)(scale.value > 1.02);
    });

  const pan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(12)
    .activeOffsetY([-18, 18])
    .failOffsetX(paging ? [-8, 8] : [-40, 40])
    .onUpdate((event) => {
      'worklet';
      if (scale.value > 1.02) {
        const maxX = ((scale.value - 1) * width) / 2;
        const maxY = ((scale.value - 1) * height) / 2;
        translateX.value = clamp(
          savedTranslateX.value + event.translationX,
          -maxX,
          maxX
        );
        translateY.value = clamp(
          savedTranslateY.value + event.translationY,
          -maxY,
          maxY
        );
        return;
      }

      translateX.value = paging ? 0 : event.translationX * 0.15;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      'worklet';
      if (scale.value <= 1.02) {
        if (event.translationY > DISMISS_DISTANCE || event.velocityY > 900) {
          runOnJS(close)();
          return;
        }

        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        return;
      }

      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onFinalize((_event, success) => {
      'worklet';
      if (success) {
        return;
      }

      if (scale.value <= 1.02) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDistance(16)
    .onEnd(() => {
      'worklet';
      if (scale.value > 1.1) {
        savedScale.value = MIN_SCALE;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        scale.value = withTiming(MIN_SCALE);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        runOnJS(reportZoom)(false);
        return;
      }

      scale.value = withTiming(2.5);
      savedScale.value = 2.5;
      runOnJS(reportZoom)(true);
    });

  const gesture = Gesture.Simultaneous(
    pinch,
    Gesture.Exclusive(doubleTap, pan)
  );

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => {
    const dragged =
      scale.value <= 1.02 ? Math.min(Math.abs(translateY.value) / 280, 1) : 0;
    return {
      opacity: 1 - dragged * 0.45,
    };
  });

  return (
    <View style={{ width, height }}>
      {paging ? null : (
        <Animated.View
          style={[styles.backdrop, backdropStyle]}
          accessibilityElementsHidden
        />
      )}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={styles.stage}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="image"
        >
          {uri.length > 0 ? (
            <AnimatedImage
              source={{ uri }}
              contentFit="contain"
              cachePolicy="disk"
              style={[{ width, height }, imageStyle]}
              accessible={false}
            />
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
