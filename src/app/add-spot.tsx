import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LocationPicker from '../components/LocationPicker';
import SpotImagePicker from '../components/SpotImagePicker';

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function AddSpotScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const [imageUri, setImageUri] = useState<string | undefined>();
  const layer = searchParams.layer === 'satellite' ? 'satellite' : 'default';
  const [selectedLocation, setSelectedLocation] = useState<Coordinates>({
    latitude: Number.isFinite(Number(searchParams.lat)) ? Number(searchParams.lat) : 41.8268,
    longitude: Number.isFinite(Number(searchParams.lng)) ? Number(searchParams.lng) : -71.4010,
  });

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
      >
        <Text className="text-sm text-gray-600 mb-2">Select Image</Text>
        <SpotImagePicker imageUri={imageUri} onImageSelected={setImageUri} />

        <Text className="text-sm text-gray-600 mb-2">Spot name</Text>
        <TextInput className="border border-gray-300 rounded-md p-3 mb-4" placeholder="Name" />

        <Text className="text-sm text-gray-600 mb-2">Description</Text>
        <TextInput className="border border-gray-300 rounded-md p-3 mb-4 h-30" placeholder="Describe the spot" multiline />

        <LocationPicker
          initialLatitude={selectedLocation.latitude}
          initialLongitude={selectedLocation.longitude}
          initialLayer={layer}
          onLocationChange={(latitude, longitude) => setSelectedLocation({ latitude, longitude })}
        />

        <Pressable className="bg-sky-600 py-3 rounded-md items-center" onPress={() => { /* TODO: implement save */ }}>
          <Text className="text-white font-semibold">Save Spot</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 24, flexGrow: 1, marginTop: 10 },
});
