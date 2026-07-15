import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LocationPicker from '../components/LocationPicker';
import SpotImagePicker from '../components/SpotImagePicker';
import { isAddSpotFormValid } from '../lib/addSpotForm';
import { useAuthStore } from '../store/authStore';
import { useSpotsStore } from '../store/spotsStore';

type Coordinates = {
  latitude: number;
  longitude: number;
};

const AUTH_REQUIRED_ERROR = 'You must be signed in to edit a spot.';
const MISSING_SPOT_ERROR =
  'This spot could not be found. Return to your profile and try again.';

export default function EditSpotScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const spotId = Array.isArray(searchParams.id)
    ? searchParams.id[0]
    : searchParams.id;

  const mySpots = useSpotsStore((s) => s.mySpots);
  const updateSpot = useSpotsStore((s) => s.updateSpot);
  const session = useAuthStore((s) => s.session);

  const spot = useMemo(
    () => mySpots.find((item) => item.id === spotId),
    [mySpots, spotId]
  );

  const [name, setName] = useState(spot?.name ?? '');
  const [description, setDescription] = useState(spot?.description ?? '');
  // Start from the existing image; only send a new one if the user picks one.
  const [imageUri, setImageUri] = useState<string | undefined>(
    spot?.imageUris[0]
  );
  const [imageChanged, setImageChanged] = useState(false);

  const [selectedLocation, setSelectedLocation] = useState<Coordinates>({
    latitude: spot?.latitude ?? 41.8268,
    longitude: spot?.longitude ?? -71.401,
  });

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const interactionTimeoutRef = useRef<number | null>(null);

  const isFormValid = isAddSpotFormValid(imageUri, name, description);

  const handleImageSelected = (uri: string) => {
    setImageUri(uri);
    setImageChanged(true);
  };

  const handleLocationChange = useCallback(
    (latitude: number, longitude: number) => {
      setSelectedLocation({ latitude, longitude });
    },
    []
  );

  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current as unknown as number);
        interactionTimeoutRef.current = null;
      }
    };
  }, []);

  const handleSave = async () => {
    if (!isFormValid || saving || !spotId) return;

    const accessToken = session?.access_token;
    if (!accessToken) {
      setSaveError(AUTH_REQUIRED_ERROR);
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      await updateSpot(
        spotId,
        {
          name: name.trim(),
          description: description.trim(),
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          imageUri: imageChanged ? imageUri : undefined,
        },
        accessToken
      );
      router.back();
    } catch (error) {
      setSaveError(
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'Unable to save your changes right now. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

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
            Edit Spot
          </Text>
        </View>

        <View className="w-9" />
      </View>

      {!spot ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-base text-slate-500">
            {MISSING_SPOT_ERROR}
          </Text>
        </View>
      ) : (
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
              initialLayer="satellite"
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
            <Text className="mb-3 mt-4 text-center text-sm text-red-600">
              {saveError}
            </Text>
          ) : null}

          <Pressable
            style={[
              styles.saveButton,
              (!isFormValid || saving) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!isFormValid || saving}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {saving ? (
                <>
                  <ActivityIndicator color="#ffffff" />
                  <Text
                    className="text-center text-lg text-white"
                    style={{ fontFamily: 'Outfit_700Bold', marginLeft: 8 }}
                  >
                    Saving…
                  </Text>
                </>
              ) : (
                <Text
                  className="text-center text-lg text-white"
                  style={{ fontFamily: 'Outfit_700Bold' }}
                >
                  Save Changes
                </Text>
              )}
            </View>
          </Pressable>
        </ScrollView>
      )}
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
    marginTop: 24,
  },

  saveButtonDisabled: {
    backgroundColor: '#BCC8C4',
  },
});
