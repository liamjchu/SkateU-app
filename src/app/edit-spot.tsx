import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from '../components/FeedbackPressable';
import LocationPicker from '../components/LocationPicker';
import SpotImagePicker from '../components/SpotImagePicker';
import {
    getSpotFormErrors,
    isAddSpotFormValid,
    SPOT_DESCRIPTION_MAX,
    SPOT_NAME_MAX,
} from '../lib/addSpotForm';
import { triggerHaptic } from '../lib/haptics';
import { useAuthStore } from '../store/authStore';
import { useMapViewStore } from '../store/mapViewStore';
import { useSpotsStore } from '../store/spotsStore';
import type { SpotImageAsset } from '../types/spot';


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
  const sharedMapLayer = useMapViewStore((state) => state.mapLayer);
  const layer =
    searchParams.layer === 'satellite' || searchParams.layer === 'default'
      ? searchParams.layer
      : sharedMapLayer;

  const mySpots = useSpotsStore((s) => s.mySpots);
  const myLoading = useSpotsStore((s) => s.myLoading);
  const fetchMySpots = useSpotsStore((s) => s.fetchMySpots);
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
  const [imageAsset, setImageAsset] = useState<SpotImageAsset | undefined>();
  const [imageChanged, setImageChanged] = useState(false);

  const [selectedLocation, setSelectedLocation] = useState<Coordinates>({
    latitude: spot?.latitude ?? 41.8268,
    longitude: spot?.longitude ?? -71.401,
  });

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [touched, setTouched] = useState({
    image: false,
    name: false,
    description: false,
  });

  const interactionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (accessToken && spotId) {
      fetchMySpots(accessToken);
    }
  }, [fetchMySpots, session?.access_token, spotId]);

  useEffect(() => {
    if (!spot) {
      return;
    }

    setName(spot.name);
    setDescription(spot.description);
    setImageUri(spot.imageUris[0]);
    setImageAsset(undefined);
    setImageChanged(false);
    setSelectedLocation({
      latitude: spot.latitude,
      longitude: spot.longitude,
    });
  }, [spot]);

  const isFormValid = isAddSpotFormValid(imageUri, name, description);
  const formErrors = getSpotFormErrors(imageUri, name, description);
  const showImageError = hasSubmitted || touched.image;
  const showNameError = hasSubmitted || touched.name;
  const showDescriptionError = hasSubmitted || touched.description;

  const handleImageSelected = (asset: SpotImageAsset) => {
    setTouched((current) => ({ ...current, image: true }));
    setImageUri(asset.uri);
    setImageAsset(asset);
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
    setHasSubmitted(true);
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
          image: imageChanged ? imageAsset : undefined,
        },
        accessToken
      );
      triggerHaptic('success');
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
        className="h-[136px] flex-row items-center justify-between border-b border-white/10 bg-[#21473f] px-4 pb-3"
        style={[styles.headerShadow, { paddingTop: insets.top }]}
      >
        <FeedbackPressable
          haptic="light"
          onPress={() => router.back()}
          className="h-12 w-12 items-center justify-center rounded-full"
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text className="text-xl font-bold text-white">❮</Text>
        </FeedbackPressable>

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
          {myLoading ? <ActivityIndicator size="small" color="#21473f" /> : null}
          <Text className="mt-3 text-center text-base text-slate-500">
            {myLoading ? 'Loading spot…' : MISSING_SPOT_ERROR}
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 126}
          style={{ flex: 1 }}
        >
          <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-2 flex-row items-center">
            <Text style={[styles.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>PHOTO</Text>
            <Text className="ml-2 font-outfit-medium text-xs text-slate-500">Required</Text>
          </View>

          <View style={styles.photoWrapper}>
            <SpotImagePicker
              imageUri={imageUri}
              onImageSelected={handleImageSelected}
            />
          </View>
          {showImageError && formErrors.image ? (
            <Text className="-mt-4 mb-3 text-sm text-[#B45F58]">{formErrors.image}</Text>
          ) : null}

          {/* NAME */}
          <View className="mb-2 flex-row items-center">
            <Text style={[styles.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>SPOT NAME</Text>
            <Text className="ml-2 font-outfit-medium text-xs text-slate-500">(Required)</Text>
          </View>
          <TextInput
            style={[styles.input, showNameError && formErrors.name ? styles.inputError : null]}
            placeholder="e.g. Library 5 Stair, Parking Garage Ledge..."
            placeholderTextColor="#879995"
            accessibilityLabel="Spot name, required"
            accessibilityHint="Enter a short name for this skate spot"
            value={name}
            maxLength={SPOT_NAME_MAX}
            onBlur={() => setTouched((current) => ({ ...current, name: true }))}
            onChangeText={setName}
          />
          <View className="mt-1 min-h-5 flex-row items-center justify-between">
            <Text
              className="flex-1 pr-2 text-sm text-[#B45F58]"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {showNameError && formErrors.name ? formErrors.name : ' '}
            </Text>
            <Text className="font-outfit-medium text-xs text-slate-500">
              {name.length} / {SPOT_NAME_MAX}
            </Text>
          </View>

          {/* DESCRIPTION */}
          <View className="mb-2 mt-4 flex-row items-center">
            <Text style={[styles.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>DESCRIPTION</Text>
            <Text className="ml-2 font-outfit-medium text-xs text-slate-500">(Required)</Text>
          </View>
          <TextInput
            style={[styles.descriptionInput, showDescriptionError && formErrors.description ? styles.inputError : null]}
            placeholder="Describe the spot — obstacle type, spot condition, security..."
            placeholderTextColor="#879995"
            accessibilityLabel="Spot description, required"
            accessibilityHint="Describe the obstacle, condition, and security details"
            multiline
            maxLength={SPOT_DESCRIPTION_MAX}
            textAlignVertical="top"
            value={description}
            onBlur={() => setTouched((current) => ({ ...current, description: true }))}
            onChangeText={setDescription}
          />
          <View className="mt-1 min-h-5 flex-row items-center justify-between">
            <Text
              className="flex-1 pr-2 text-sm text-[#B45F58]"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {showDescriptionError && formErrors.description ? formErrors.description : ' '}
            </Text>
            <Text className="font-outfit-medium text-xs text-slate-500">
              {description.length} / {SPOT_DESCRIPTION_MAX}
            </Text>
          </View>

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
            <View className="-mt-4 mb-3 flex-row items-center rounded-xl bg-[#EBF2F0] px-3 py-2">
              <Text className="font-outfit-bold text-sm text-[#21473f]">✓ Spot location selected</Text>
              <Text className="ml-2 flex-1 text-right font-outfit-medium text-xs text-slate-500">
                {selectedLocation.latitude.toFixed(5)}, {selectedLocation.longitude.toFixed(5)}
              </Text>
            </View>
          </View>

          {saveError ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="mb-3 mt-4 text-center text-sm text-[#B45F58]">
              {saveError}
            </Text>
          ) : null}

          <FeedbackPressable
            style={[
              styles.saveButton,
              saving && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={saving ? 'Saving changes' : 'Save changes'}
            accessibilityHint={!isFormValid ? 'Review the required fields and fix the highlighted errors' : undefined}
            accessibilityState={{ disabled: saving, busy: saving }}
          >
            <View style={styles.saveContent}>
              {saving ? (
                <>
                  <ActivityIndicator color="#ffffff" style={styles.saveIndicator} />
                  <Text style={styles.saveTextWithMargin}>
                    Saving…
                  </Text>
                </>
              ) : (
                <Text style={styles.saveText}>
                  Save Changes
                </Text>
              )}
            </View>
          </FeedbackPressable>
          </ScrollView>
        </KeyboardAvoidingView>
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
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
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

  inputError: {
    borderColor: '#B45F58',
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

  saveContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  saveIndicator: {},

  saveText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    textAlign: 'center',
  },

  saveTextWithMargin: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    marginLeft: 8,
    textAlign: 'center',
  },

  saveButtonDisabled: {
    backgroundColor: '#BCC8C4',
  },
});
