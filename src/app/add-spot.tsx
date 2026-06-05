import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LocationPicker from '../components/LocationPicker';
import SpotImagePicker from '../components/SpotImagePicker';
import { useSpots } from '../context/SpotsContext';
import type { Spot } from '../types/spot';

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function AddSpotScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const layer = searchParams.layer === 'satellite' ? 'satellite' : 'default';
  const [selectedLocation, setSelectedLocation] = useState<Coordinates>({
    latitude: Number.isFinite(Number(searchParams.lat)) ? Number(searchParams.lat) : 41.8268,
    longitude: Number.isFinite(Number(searchParams.lng)) ? Number(searchParams.lng) : -71.4010,
  });

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const interactionTimeoutRef = useRef<number | null>(null);
  const { spots, addSpot } = useSpots();

  const handleSave = () => {
    const isValid = !!imageUri && name.trim().length > 0 && description.trim().length > 0;
    if (!isValid) return;

    const newSpot: Spot = {
      id: String(Date.now()),
      name: name.trim(),
      description: description.trim(),
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      imageUris: imageUri ? [imageUri] : [],
    };

    addSpot(newSpot);
    router.back();
  };

  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current as unknown as number);
        interactionTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <Text className="text-lg font-semibold">Add New Spot</Text>
        <Pressable onPress={() => router.back()} className="px-2 py-1">
          <Text className="text-sky-600">Close</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        className="px-4"
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
      >
        <Text className="text-sm text-gray-600 mb-2">Select Image</Text>
        <SpotImagePicker imageUri={imageUri} onImageSelected={setImageUri} />

        <Text className="text-sm text-gray-600 mb-2">Spot name</Text>
        <TextInput
          className="border border-gray-300 rounded-md p-3 mb-4"
          placeholder="Name"
          value={name}
          onChangeText={setName}
        />

        <Text className="text-sm text-gray-600 mb-2">Description</Text>
        <TextInput
          className="border border-gray-300 rounded-md p-3 mb-4 h-30"
          placeholder="Describe the spot"
          multiline
          value={description}
          onChangeText={setDescription}
        />

        <LocationPicker
          initialLatitude={selectedLocation.latitude}
          initialLongitude={selectedLocation.longitude}
          initialLayer={layer}
          onLocationChange={(latitude, longitude) => setSelectedLocation({ latitude, longitude })}
          onInteractionChange={(isInteracting: boolean) => {
            if (interactionTimeoutRef.current) {
              clearTimeout(interactionTimeoutRef.current as unknown as number);
              interactionTimeoutRef.current = null;
            }

            if (isInteracting) {
              setScrollEnabled(false);
              interactionTimeoutRef.current = setTimeout(() => {
                setScrollEnabled(true);
                interactionTimeoutRef.current = null;
              }, 6000) as unknown as number;
            } else {
              setScrollEnabled(true);
            }
          }}
        />

        {(() => {
          const isValid = !!imageUri && name.trim().length > 0 && description.trim().length > 0;
          return (
            <Pressable
              className={`py-3 rounded-md items-center ${isValid ? 'bg-sky-600' : 'bg-gray-300'}`}
              onPress={handleSave}
              disabled={!isValid}
            >
              <Text className={`${isValid ? 'text-white' : 'text-gray-600'} font-semibold`}>Save Spot</Text>
            </Pressable>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 24, flexGrow: 1, marginTop: 10 },
});
