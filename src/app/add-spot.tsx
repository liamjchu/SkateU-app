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
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>❮</Text>
        </Pressable>

        <View style={styles.headerTitleWrapper}>
          <Text
            style={styles.headerTitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Add New Spot
          </Text>
        </View>

        <View style={styles.headerSpacer} />
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
            onImageSelected={setImageUri}
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
        <Pressable
          style={[
            styles.saveButton,
            !isFormValid && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!isFormValid}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text 
              className="text-center text-lg text-white"
              style={{ fontFamily: 'Outfit_700Bold' }}
            >
              Save Spot
            </Text>
            <Text
              className="text-white text-sm"
              style={{ fontFamily: 'Outfit_700Bold', marginLeft: 6 }}
            >
              ❯
            </Text>
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

  header: {
    backgroundColor: '#21473f',
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 70,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },

  backButton: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    padding: 8,
    width: 36,
  },

  backButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },

  headerTitleWrapper: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 320,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 24,
  },

  headerSpacer: {
    width: 36,
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
