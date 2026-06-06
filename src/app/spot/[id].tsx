import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpots } from '../../context/SpotsContext';

export default function SpotDetailsScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const { spots, removeSpot } = useSpots();
  const spotId = searchParams.id as string | undefined;
  const spot = spots.find((item) => item.id === spotId);

  const handleDeleteSpot = useCallback(() => {
    if (!spot) return

    Alert.alert(
      'Delete spot',
      'Are you sure you want to permanently delete this spot?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeSpot(spot.id)
              router.back()
            } catch (error) {
              console.warn('Failed to delete spot', error)
            }
          },
        },
      ]
    )
  }, [removeSpot, router, spot])

  if (!spot) {
    return (
      <SafeAreaView style={styles.safe}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-lg font-semibold text-slate-900">Spot not found</Text>
          <Text className="text-sm text-slate-500 mt-2 text-center">This spot is no longer available or the id is invalid.</Text>
          <Pressable onPress={() => router.back()} className="mt-6 rounded-2xl bg-slate-900 px-5 py-3">
            <Text className="text-white font-semibold">Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <Text className="text-lg font-semibold">Spot Details</Text>
        <Pressable onPress={() => router.back()} className="px-2 py-1">
          <Text className="text-sky-600">Close</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} className="px-4">
        <Text className="text-2xl font-bold text-slate-900">{spot.name}</Text>
        <Text className="text-sm text-slate-500 mt-2">{spot.description}</Text>

        {spot.imageUris.length > 0 ? (
          <Image source={{ uri: spot.imageUris[0] }} style={styles.image} resizeMode="cover" />
        ) : (
          <View className="mt-6 rounded-3xl bg-slate-100 h-80 items-center justify-center">
            <Text className="text-slate-500">No image available</Text>
          </View>
        )}

        <View className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <Text className="text-sm font-semibold text-slate-900">Location</Text>
          <Text className="mt-2 text-sm text-slate-600">Latitude: {spot.latitude.toFixed(6)}</Text>
          <Text className="text-sm text-slate-600">Longitude: {spot.longitude.toFixed(6)}</Text>
        </View>

        <Pressable
          onPress={handleDeleteSpot}
          className="mt-6 rounded-3xl bg-red-600 py-4 items-center justify-center"
        >
          <Text className="text-white font-semibold">Delete Spot</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 24 },
  image: { width: '100%', height: 280, borderRadius: 24, marginTop: 20 },
});
