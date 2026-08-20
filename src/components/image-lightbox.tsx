import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    BackHandler,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from './FeedbackPressable';

type ImageLightboxProps = {
  visible: boolean;
  uris: string[];
  initialIndex?: number;
  onClose: () => void;
  accessibilityLabel: string;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DISMISS_DISTANCE = 120;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

const AnimatedImage = Animated.createAnimatedComponent(Image);

type ZoomablePhotoProps = {
  uri: string;
  width: number;
  height: number;
  paging: boolean;
  onClose: () => void;
  onZoomChange: (zoomed: boolean) => void;
  accessibilityLabel: string;
};

function ZoomablePhoto({
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
    .onUpdate((event) => {
      'worklet';
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

  const panBase = Gesture.Pan().minDistance(8);
  const pan = (paging
    ? panBase.activeOffsetY([-24, 24]).failOffsetX([-20, 20])
    : panBase
  )
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

      translateX.value = event.translationX * 0.2;
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

      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
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

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

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
              resizeMode="contain"
              style={[{ width, height }, imageStyle]}
              accessible={false}
            />
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default function ImageLightbox({
  visible,
  uris,
  initialIndex = 0,
  onClose,
  accessibilityLabel,
}: ImageLightboxProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const paging = uris.length > 1;
  const safeIndex = Math.min(Math.max(initialIndex, 0), Math.max(uris.length - 1, 0));

  useEffect(() => {
    if (!visible) {
      return;
    }

    setIndex(safeIndex);
    setZoomed(false);
    pagerRef.current?.scrollTo({ x: safeIndex * width, animated: false });
  }, [safeIndex, visible, width]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose();
        return true;
      }
    );

    return () => subscription.remove();
  }, [onClose, visible]);

  if (!visible || uris.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        {paging ? <View style={styles.backdrop} /> : null}
        {paging ? (
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const next = Math.round(event.nativeEvent.contentOffset.x / width);
              if (next >= 0 && next < uris.length) {
                setIndex(next);
              }
            }}
          >
            {uris.map((uri, photoIndex) => (
              <ZoomablePhoto
                key={`${uri}-${photoIndex}`}
                uri={uri}
                width={width}
                height={height}
                paging
                onClose={onClose}
                onZoomChange={setZoomed}
                accessibilityLabel={accessibilityLabel}
              />
            ))}
          </ScrollView>
        ) : (
          <ZoomablePhoto
            uri={uris[0] ?? ''}
            width={width}
            height={height}
            paging={false}
            onClose={onClose}
            onZoomChange={setZoomed}
            accessibilityLabel={accessibilityLabel}
          />
        )}
        <View
          pointerEvents="box-none"
          style={[styles.closeWrap, { top: Math.max(insets.top, 12) }]}
        >
          {paging ? (
            <Text className="font-outfit-bold text-[15px] text-white">
              {index + 1} / {uris.length}
            </Text>
          ) : (
            <View />
          )}
          <FeedbackPressable
            haptic="selection"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center rounded-full bg-black/50"
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </FeedbackPressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
