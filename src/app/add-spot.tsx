import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LocationPicker from '../components/LocationPicker';
import SpotImagePicker from '../components/SpotImagePicker';
import { useSpots } from '../context/SpotsContext';
import type { Spot } from '../types/spot';

type Coordinates = {
  latitude: number;
  longitude: number;
};

const generateSpotId = () => {
  const webCrypto = globalThis.crypto as
    | { randomUUID?: () => string }
    | undefined;

  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

export default function AddSpotScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();

  const [imageUri, setImageUri] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const layer =
    searchParams.layer === 'satellite' ? 'satellite' : 'default';

  const schoolId = Array.isArray(searchParams.schoolId)
    ? searchParams.schoolId[0]
    : searchParams.schoolId;

  const schoolName = Array.isArray(searchParams.schoolName)
    ? searchParams.schoolName[0]
    : searchParams.schoolName;

  const [selectedLocation, setSelectedLocation] = useState<Coordinates>({
    latitude: Number.isFinite(Number(searchParams.lat))
      ? Number(searchParams.lat)
      : 41.8268,
    longitude: Number.isFinite(Number(searchParams.lng))
      ? Number(searchParams.lng)
      : -71.401,
  });

  const [scrollEnabled, setScrollEnabled] = useState(true);

  const interactionTimeoutRef = useRef<number | null>(null);

  const { addSpot } = useSpots();

  const isFormValid =
    !!imageUri &&
    name.trim().length > 0 &&
    description.trim().length > 0;

  const handleLocationChange = useCallback(
    (latitude: number, longitude: number) => {
      setSelectedLocation({ latitude, longitude });
    },
    []
  );

  const handleSave = async () => {
    if (!isFormValid) return;

    const newSpot: Spot = {
      id: generateSpotId(),
      name: name.trim(),
      description: description.trim(),
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      imageUris: imageUri ? [imageUri] : [],
      city: '',
      state: '',
      schoolId: schoolId || undefined,
    };

    try {
      await addSpot(newSpot);
      router.back();
    } catch (error) {
      console.warn('Failed to save spot', error);
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
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.schoolLabel}>
            {schoolName || 'School'}
          </Text>

          <Text style={styles.headerTitle}>
            Add New Spot
          </Text>
        </View>

        <Pressable
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
      >
        {/* PHOTO */}
        <Text style={styles.sectionLabel}>PHOTO</Text>

        <View style={styles.photoWrapper}>
          <SpotImagePicker
            imageUri={imageUri}
            onImageSelected={setImageUri}
          />
        </View>

        {/* NAME */}
        <Text style={styles.sectionLabel}>SPOT NAME</Text>

        <TextInput
          style={styles.input}
          placeholder="e.g. Library Steps, Parking Garage..."
          placeholderTextColor="#879995"
          value={name}
          onChangeText={setName}
        />

        {/* DESCRIPTION */}
        <Text style={styles.sectionLabel}>DESCRIPTION</Text>

        <TextInput
          style={styles.descriptionInput}
          placeholder="Describe the spot — obstacles, surface, security, vibes..."
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
        <Pressable
          style={[
            styles.saveButton,
            !isFormValid && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!isFormValid}
        >
          <Text style={styles.saveButtonText}>
            Save Spot →
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  header: {
    backgroundColor: '#3c5853',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  schoolLabel: {
    color: '#D4E3DF',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -1,
  },

  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },

  sectionLabel: {
    color: '#365C56',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 18,
    letterSpacing: 0.5,
  },

  photoWrapper: {
    marginBottom: 8,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE4E1',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 17,
    color: '#223331',
  },

  descriptionInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE4E1',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    minHeight: 150,
    fontSize: 17,
    color: '#223331',
  },

  helperText: {
    color: '#8A9B98',
    fontSize: 14,
    marginBottom: 12,
  },

  mapContainer: {
    overflow: 'hidden',
    borderRadius: 24,
    marginBottom: 24,
  },

  saveButton: {
    height: 70,
    borderRadius: 24,
    backgroundColor: '#1E4D46',
    justifyContent: 'center',
    alignItems: 'center',
  },

  saveButtonDisabled: {
    backgroundColor: '#BCC8C4',
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
});