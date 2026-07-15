import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    Text,
    View,
} from 'react-native';
import type { SpotImageAsset } from '../types/spot';

type SpotImagePickerProps = {
  imageUri?: string;
  onImageSelected: (asset: SpotImageAsset) => void;
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
      'Add Spot Photo',
      'Choose how you want to add a photo.',
      [
        {
          text: 'Take Photo',
          onPress: () => finish('camera'),
        },
        {
          text: 'Choose from Gallery',
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
}: SpotImagePickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

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
            ? 'Camera permission is required to take a photo.'
            : 'Photo library permission is required to choose a photo.'
        );
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.7,
              aspect: [4, 3],
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.7,
              aspect: [4, 3],
            });

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
          ? 'Unable to open the camera. Please try again.'
          : 'Unable to open the photo library. Please try again.'
      );
      console.error(exception);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="mb-6">
      <Pressable
        onPress={handlePickImage}
        className="h-78 overflow-hidden rounded-[16px] items-center justify-center bg-white"
        style={{
          borderWidth: 1,
          borderColor: '#DDE4E1',
          borderStyle: 'solid',
        }}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            resizeMode="cover"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          />
        ) : null}

        <View className="items-center justify-center px-6">
          {loading ? (
            <ActivityIndicator size="small" color="#355650" />
          ) : imageUri ? null : (
            <>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  backgroundColor: '#E9EEEC',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 18,
                }}
              >
                <Feather
                  name="camera"
                  size={26}
                  color="#355650"
                />
              </View>

              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#173A35',
                  marginBottom: 4,
                }}
              >
                Add Spot Photo
              </Text>

              <Text
                style={{
                  fontSize: 14,
                  color: '#8CA19D',
                  textAlign: 'center',
                }}
              >
                Tap to take a photo or choose from your gallery
              </Text>
            </>
          )}
        </View>
      </Pressable>

      {error ? (
        <Text className="mt-2 px-2 text-xs text-red-600">
          {error}
        </Text>
      ) : null}
    </View>
  );
}