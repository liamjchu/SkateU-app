import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
    BackHandler,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from './FeedbackPressable';
import ZoomablePhoto from './zoomable-photo';

type ImageLightboxProps = {
  visible: boolean;
  uris: string[];
  initialIndex?: number;
  onClose: () => void;
  accessibilityLabel: string;
};

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
