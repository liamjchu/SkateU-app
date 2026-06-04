import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

type SpotImagePickerProps = {
  imageUri?: string;
  onImageSelected: (uri: string) => void;
};

export default function SpotImagePicker({ imageUri, onImageSelected }: SpotImagePickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handlePickImage() {
    setError(undefined);
    setLoading(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Permission is required to select a photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        if (uri) {
          onImageSelected(uri);
        }
      }
    } catch (exception) {
      setError('Unable to open the photo library. Please try again.');
      console.error(exception);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="mb-6">
      <Pressable
        onPress={handlePickImage}
        className="h-80 rounded-3xl border border-slate-200 bg-slate-100 overflow-hidden justify-center items-center"
        style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}
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

        <View className="justify-center items-center px-6">
          {loading ? (
            <ActivityIndicator size="small" color="#0F172A" />
          ) : imageUri ? null : (
            <>
              <Text className="text-4xl mb-3">📷</Text>
              <Text className="text-base font-semibold text-slate-700">Add Spot Photo</Text>
              <Text className="text-sm text-slate-500 mt-1 text-center">Tap to choose an image from your library.</Text>
            </>
          )}
        </View>
      </Pressable>

      {error ? <Text className="text-xs text-red-600 mt-2 px-2">{error}</Text> : null}
    </View>
  );
}
