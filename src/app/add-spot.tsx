import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LocationPicker from '../components/LocationPicker';
import SpotImagePicker from '../components/SpotImagePicker';
import { isAddSpotFormValid } from '../lib/addSpotForm';
import { useAuthStore } from '../store/authStore';
import { useSpotsStore } from '../store/spotsStore';


import type { SpotImageAsset } from '../types/spot';

type Coordinates = {
  latitude: number;
  longitude: number;
};

const AUTH_REQUIRED_ERROR = 'You must be signed in to add a spot.';
const MISSING_SCHOOL_ERROR =
  'A school is required to add a spot. Return to the map and try again.';

export default function AddSpotScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [imageUri, setImageUri] = useState<string | undefined>();
  const [imageAsset, setImageAsset] = useState<SpotImageAsset | undefined>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const layer =
    searchParams.layer === 'satellite' ? 'satellite' : 'default';

  const schoolId = Array.isArray(searchParams.schoolId)
    ? searchParams.schoolId[0]
    : searchParams.schoolId;

  const [selectedLocation, setSelectedLocation] = useState<Coordinates>({
    latitude: Number.isFinite(Number(searchParams.lat))
      ? Number(searchParams.lat)
      : 41.8268,
    longitude: Number.isFinite(Number(searchParams.lng))
      ? Number(searchParams.lng)
      : -71.401,
  });

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const interactionTimeoutRef = useRef<number | null>(null);

  const addSpot = useSpotsStore((s) => s.addSpot);
  const session = useAuthStore((s) => s.session);

  const isFormValid = isAddSpotFormValid(imageUri, name, description);

  const handleImageSelected = (asset: SpotImageAsset) => {
    setImageUri(asset.uri);
    setImageAsset(asset);
  };

  const handleLocationChange = useCallback(
    (latitude: number, longitude: number) => {
      setSelectedLocation({ latitude, longitude });
    },
    []
  );

  const handleSave = async () => {
    if (!isFormValid || saving) return;

    // A school is required to associate the spot with the campus.
    if (!schoolId) {
      setSaveError(MISSING_SCHOOL_ERROR);
      return;
    }

    // Never POST without a verified session; the server rejects it and the
    // user would lose their entered data (Req 10.8).
    const accessToken = session?.access_token;
    if (!accessToken) {
      setSaveError(AUTH_REQUIRED_ERROR);
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      await addSpot(
        {
          schoolId,
          name: name.trim(),
          description: description.trim(),
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          image: imageAsset,
        },
        accessToken
      );
      // Success returns to the map, which refetches on focus (Req 10.4).
      router.back();
    } catch (error) {
      // Keep all entered data and stay on the screen (Req 10.6).
      setSaveError(
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'Unable to save this spot right now. Please try again.'
      );
    } finally {
      setSaving(false);
    }
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
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <View
        className="h-[126px] flex-row items-center justify-between border-b border-white/10 bg-[#21473f] px-4 pb-3"
        style={[styles.headerShadow, { paddingTop: insets.top }]}
      >
        <Pressable
          onPress={() => router.back()}
          className="w-9 items-center justify-center rounded-full p-2"
          accessibilityLabel="Go back"
        >
          <Text className="text-xl font-bold text-white">❮</Text>
        </Pressable>

        <View className="max-w-80 flex-1 items-center">
          <Text
            className="font-outfit-bold text-2xl text-white"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Add New Spot
          </Text>
        </View>

        <View className="w-9" />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
      >
        {/* PHOTO */}
        <Text style={[styles.sectionLabel, { marginTop: 0 }]}>PHOTO</Text>

        <View style={styles.photoWrapper}>
          <SpotImagePicker
            imageUri={imageUri}
            onImageSelected={handleImageSelected}
          />
        </View>

        {/* NAME */}
        <Text style={[styles.sectionLabel, { marginTop: 0 }]}>SPOT NAME</Text>

        <TextInput
          style={styles.input}
          placeholder="e.g. Library 5 Stair, Parking Garage Ledge..."
          placeholderTextColor="#879995"
          value={name}
          onChangeText={setName}
        />

        {/* DESCRIPTION */}
        <Text style={styles.sectionLabel}>DESCRIPTION</Text>

        <TextInput
          style={styles.descriptionInput}
          placeholder="Describe the spot — obstacle type, spot condition, security..."
          placeholderTextColor="#879995"
          multiline
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
        />

        {/* LOCATION */}
        <Text style={styles.sectionLabel}>LOCATION</Text>

        <Text style={styles.helperText}>
          Move the map until the pin is over the desired spot.
        </Text>

        <View style={styles.mapContainer}>
          <LocationPicker
            initialLatitude={selectedLocation.latitude}
            initialLongitude={selectedLocation.longitude}
            initialLayer={layer}
            onLocationChange={handleLocationChange}
            onInteractionChange={(isInteracting: boolean) => {
              if (interactionTimeoutRef.current) {
                clearTimeout(
                  interactionTimeoutRef.current as unknown as number
                );
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
        </View>

        {/* SAVE */}
        {saveError ? (
          <Text className="mb-3 text-center text-sm text-red-600">
            {saveError}
          </Text>
        ) : null}

        <Pressable
          style={[
            styles.saveButton,
            (!isFormValid || saving || !schoolId) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!isFormValid || saving || !schoolId}
        >
          <View className="flex-row items-center">
            {saving ? (
              <>
                <ActivityIndicator color="#ffffff" />
                <Text className="ml-2 text-center font-outfit-bold text-lg text-white">
                  Saving…
                </Text>
              </>
            ) : (
              <>
                <Text className="text-center font-outfit-bold text-lg text-white">
                  Save Spot
                </Text>
                <Text className="ml-1.5 font-outfit-bold text-sm text-white">
                  ❯
                </Text>
              </>
            )}
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fdfdfd',
  },

  headerShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },

  sectionLabel: {
    color: '#21473f',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 15,
    letterSpacing: 0.5,
  },

  photoWrapper: {
    marginBottom: 0,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE4E1',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 14,
    color: '#21473f',
  },

  descriptionInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE4E1',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    minHeight: 150,
    fontSize: 14,
    color: '#21473f',
  },

  helperText: {
    color: '#8A9B98',
    fontSize: 14,
    marginBottom: 12,
  },

  mapContainer: {
    overflow: 'hidden',
    borderRadius: 0,
    marginBottom: 0,
  },

  saveButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#3c5853',
    justifyContent: 'center',
    alignItems: 'center',
  },

  saveButtonDisabled: {
    backgroundColor: '#BCC8C4',
  },
});
