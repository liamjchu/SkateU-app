import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { useIsTabletLayout } from '../hooks/useIsTabletLayout';
import { SPOT_IMAGE_MAX } from '../lib/addSpotForm';
import { spotMediaUri } from '../lib/spotMedia';
import { colors } from '../constants/colors';
import type { SpotImageAsset, SpotMediaItem } from '../types/spot';
import FeedbackPressable from './FeedbackPressable';
import ImageLightbox from './image-lightbox';

type SpotImagePickerProps = {
  items: SpotMediaItem[];
  onChange: (items: SpotMediaItem[]) => void;
  max?: number;
  highlighted?: boolean;
};

type ImageSource = 'camera' | 'gallery';

const THUMB_SIZE = 88;

function chooseImageSource(): Promise<ImageSource | undefined> {
  return new Promise((resolve) => {
    let resolved = false;

    const finish = (source?: ImageSource) => {
      if (resolved) return;
      resolved = true;
      resolve(source);
    };

    Alert.alert(
      'Add a photo',
      'Camera or camera roll?',
      [
        {
          text: 'Take photo',
          onPress: () => finish('camera'),
        },
        {
          text: 'Choose from gallery',
          onPress: () => finish('gallery'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => finish(),
        },
      ],
      { cancelable: true, onDismiss: () => finish() }
    );
  });
}

function assetFromPicker(asset: ImagePicker.ImagePickerAsset): SpotImageAsset | null {
  if (!asset.uri) {
    return null;
  }

  return {
    uri: asset.uri,
    fileName: asset.fileName ?? undefined,
    mimeType: asset.mimeType ?? undefined,
  };
}

export default function SpotImagePicker({
  items,
  onChange,
  max = SPOT_IMAGE_MAX,
  highlighted = false,
}: SpotImagePickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const isTabletLayout = useIsTabletLayout();
  const remaining = Math.max(0, max - items.length);
  const uris = items.map(spotMediaUri);
  const atMax = remaining === 0;
  const emptyHeight = isTabletLayout ? 260 : 200;

  async function handlePickImage() {
    if (atMax) {
      return;
    }

    setError(undefined);

    const source = await chooseImageSource();
    if (!source) return;

    setLoading(true);

    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setError(
          source === 'camera'
            ? 'Need camera access for that.'
            : 'Need photo library access for that.'
        );
        return;
      }

      const imagePickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        ...(source === 'gallery'
          ? {
              allowsMultipleSelection: remaining > 1,
              selectionLimit: remaining,
            }
          : {}),
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(imagePickerOptions)
          : await ImagePicker.launchImageLibraryAsync(imagePickerOptions);

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const nextItems: SpotMediaItem[] = [...items];
      for (const picked of result.assets) {
        if (nextItems.length >= max) {
          break;
        }
        const asset = assetFromPicker(picked);
        if (asset) {
          nextItems.push({ kind: 'new', asset });
        }
      }
      onChange(nextItems);
    } catch (exception) {
      setError(
        source === 'camera'
          ? 'Couldn’t open the camera. Try again?'
          : 'Couldn’t open your photos. Try again?'
      );
      console.error(exception);
    } finally {
      setLoading(false);
    }
  }

  function handleRemove(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  function handleMakeCover(index: number) {
    if (index === 0) {
      return;
    }

    const next = [...items];
    const [selected] = next.splice(index, 1);
    next.unshift(selected);
    onChange(next);
  }

  function handleLongPress(index: number) {
    if (index === 0) {
      return;
    }

    Alert.alert(
      'Cover photo',
      'Use this as the cover? It’s the photo people see first.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Make cover',
          onPress: () => handleMakeCover(index),
        },
      ]
    );
  }

  const borderClass = highlighted ? 'border-errorBorder' : 'border-border-soft';

  return (
    <View>
      {items.length === 0 ? (
        <View
          className={`overflow-hidden rounded-2xl border bg-field ${borderClass}`}
          style={{ height: emptyHeight }}
        >
          <FeedbackPressable
            haptic="light"
            disabled={loading}
            onPress={handlePickImage}
            className="h-full w-full items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Add spot photo"
            accessibilityHint="Opens camera or photo library"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            <View className="items-center justify-center px-6">
              {loading ? (
                <ActivityIndicator size="small" color={colors.ink} />
              ) : (
                <>
                  <View className="mb-2 h-12 w-12 items-center justify-center rounded-2xl bg-accent">
                    <Feather name="camera" size={22} color={colors.brand} />
                  </View>
                  <Text className="font-outfit-semibold text-base text-ink">
                    Add photo
                  </Text>
                </>
              )}
            </View>
          </FeedbackPressable>
        </View>
      ) : (
        <View>
          <ScrollView
            horizontal
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="items-center"
          >
            {items.map((item, index) => {
              const uri = spotMediaUri(item);
              return (
                <View
                  key={`${item.kind}-${uri}-${index}`}
                  className={`mr-2 overflow-hidden rounded-2xl border bg-field ${borderClass}`}
                  style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
                >
                  <FeedbackPressable
                    haptic="light"
                    disablePressScale
                    disabled={loading}
                    onPress={() => setLightboxIndex(index)}
                    onLongPress={() => handleLongPress(index)}
                    delayLongPress={350}
                    className="h-full w-full"
                    accessibilityRole="button"
                    accessibilityLabel={
                      index === 0
                        ? 'View cover photo'
                        : `View photo ${index + 1}`
                    }
                    accessibilityHint="Opens the photo. Long press to make it the cover."
                  >
                    <Image
                      source={{ uri }}
                      resizeMode="cover"
                      className="h-full w-full"
                      accessible={false}
                    />
                  </FeedbackPressable>
                  {index === 0 ? (
                    <View
                      pointerEvents="none"
                      className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5"
                    >
                      <Text className="font-outfit-bold text-[10px] text-white">
                        Cover
                      </Text>
                    </View>
                  ) : null}
                  <View className="absolute right-1 top-1">
                    <FeedbackPressable
                      haptic="light"
                      onPress={() => handleRemove(index)}
                      disabled={loading}
                      className="h-6 w-6 items-center justify-center rounded-full bg-black/60"
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${index + 1}`}
                    >
                      <Feather name="x" size={14} color="#FFFFFF" />
                    </FeedbackPressable>
                  </View>
                </View>
              );
            })}
            {!atMax ? (
              <FeedbackPressable
                haptic="light"
                disabled={loading}
                onPress={handlePickImage}
                className={`items-center justify-center rounded-2xl border bg-field ${borderClass}`}
                style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
                accessibilityRole="button"
                accessibilityLabel="Add another photo"
                accessibilityHint="Opens camera or photo library"
                accessibilityState={{ disabled: loading, busy: loading }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : (
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-accent">
                    <Feather name="camera" size={18} color={colors.brand} />
                  </View>
                )}
              </FeedbackPressable>
            ) : null}
          </ScrollView>
          <Text className="mt-2 px-1 font-outfit-medium text-sm tabular-nums text-muted">
            {items.length}/{max}
          </Text>
          {atMax ? (
            <Text className="mt-1 px-1 font-outfit-medium text-xs text-muted">
              That’s the max — {max} photos.
            </Text>
          ) : null}
        </View>
      )}

      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="mt-2 px-2 text-xs text-errorText"
        >
          {error}
        </Text>
      ) : null}

      <ImageLightbox
        visible={lightboxIndex !== null}
        uris={uris}
        initialIndex={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
        accessibilityLabel="Full screen spot photo"
      />
    </View>
  );
}
