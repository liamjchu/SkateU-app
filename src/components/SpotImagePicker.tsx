import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Text,
    View,
} from 'react-native';
import { useIsTabletLayout } from '../hooks/useIsTabletLayout';
import { colors } from '../constants/colors';
import type { SpotImageAsset } from '../types/spot';
import FeedbackPressable from './FeedbackPressable';
import ImageLightbox from './image-lightbox';

type SpotImagePickerProps = {
  imageUri?: string;
  onImageSelected: (asset: SpotImageAsset) => void;
  highlighted?: boolean;
};

type ImageSource = 'camera' | 'gallery';

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

export default function SpotImagePicker({
  imageUri,
  onImageSelected,
  highlighted = false,
}: SpotImagePickerProps) {
  const isTabletLayout = useIsTabletLayout();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const pickerHeight = isTabletLayout ? 260 : 200;

  async function handlePickImage() {
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
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(imagePickerOptions)
          : await ImagePicker.launchImageLibraryAsync(imagePickerOptions);

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.uri;

        if (uri) {
          onImageSelected({
            uri,
            fileName: asset.fileName ?? undefined,
            mimeType: asset.mimeType ?? undefined,
          });
        }
      }
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

  return (
    <View>
      <View
        className={`overflow-hidden rounded-2xl border bg-field ${
          highlighted ? 'border-errorBorder' : 'border-border-soft'
        }`}
        style={{ height: pickerHeight }}
      >
        {imageUri ? (
          <FeedbackPressable
            haptic="light"
            disablePressScale
            disabled={loading}
            onPress={() => setLightboxOpen(true)}
            className="absolute inset-0"
            accessibilityRole="button"
            accessibilityLabel="View full screen photo"
            accessibilityHint="Opens the photo. Pinch or double tap to zoom."
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            <Image
              source={{ uri: imageUri }}
              resizeMode="cover"
              className="h-full w-full"
              accessible={false}
            />
          </FeedbackPressable>
        ) : (
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
        )}

        {imageUri && !loading ? (
          <View className="absolute bottom-4 left-0 right-0 items-center">
            <FeedbackPressable
              haptic="light"
              onPress={handlePickImage}
              className="flex-row items-center rounded-full bg-black/60 px-4 py-2"
              accessibilityRole="button"
              accessibilityLabel="Change spot photo"
              accessibilityHint="Opens camera or photo library"
            >
              <Feather name="camera" size={16} color="#FFFFFF" />
              <Text className="ml-2 font-outfit-bold text-sm text-white">
                Change photo
              </Text>
            </FeedbackPressable>
          </View>
        ) : null}

        {imageUri && loading ? (
          <View className="absolute inset-0 items-center justify-center bg-black/20">
            <ActivityIndicator size="small" color={colors.white} />
          </View>
        ) : null}
      </View>

      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="mt-2 px-2 text-xs text-errorText"
        >
          {error}
        </Text>
      ) : null}

      {imageUri ? (
        <ImageLightbox
          visible={lightboxOpen}
          uri={imageUri}
          onClose={() => setLightboxOpen(false)}
          accessibilityLabel="Full screen spot photo"
        />
      ) : null}
    </View>
  );
}
