import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef } from 'react';
import {
    BackHandler,
    Image,
    Modal,
    StyleSheet,
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
  uri: string;
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

export default function ImageLightbox({
  visible,
  uri,
  onClose,
  accessibilityLabel,
}: ImageLightboxProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback(() => {
    onCloseRef.current();
  }, []);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      return;
    }

    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [scale, savedScale, savedTranslateX, savedTranslateY, translateX, translateY, uri, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        close();
        return true;
      }
    );

    return () => subscription.remove();
  }, [close, visible]);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clamp(savedScale.value * event.scale, 0.85, MAX_SCALE);
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        savedScale.value = MIN_SCALE;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        scale.value = withTiming(MIN_SCALE);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        return;
      }

      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .minDistance(8)
    .onUpdate((event) => {
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
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.1) {
        savedScale.value = MIN_SCALE;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        scale.value = withTiming(MIN_SCALE);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        return;
      }

      scale.value = withTiming(2.5);
      savedScale.value = 2.5;
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={close}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View
          style={[styles.backdrop, backdropStyle]}
          accessibilityElementsHidden
        />
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
        <View
          pointerEvents="box-none"
          style={[styles.closeWrap, { top: Math.max(insets.top, 12) }]}
        >
          <FeedbackPressable
            haptic="selection"
            onPress={close}
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
    right: 16,
    zIndex: 2,
  },
});
