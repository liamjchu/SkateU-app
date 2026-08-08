import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeedbackPressable from '../components/FeedbackPressable';
import LocationPicker, {
    type LocationPickerStatus,
} from '../components/LocationPicker';
import ScreenHeader from '../components/screen-header';
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

const AUTH_REQUIRED_ERROR = 'You must be signed in to add a spot.';
const MISSING_SCHOOL_ERROR =
  'A school is required to add a spot. Return to the map and try again.';

export default function AddSpotScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const searchParams = useLocalSearchParams();

  const [imageUri, setImageUri] = useState<string | undefined>();
  const [imageAsset, setImageAsset] = useState<SpotImageAsset | undefined>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const sharedMapLayer = useMapViewStore((state) => state.mapLayer);
  const layer =
    searchParams.layer === 'satellite' || searchParams.layer === 'default'
      ? searchParams.layer
      : sharedMapLayer;

  const schoolId = Array.isArray(searchParams.schoolId)
    ? searchParams.schoolId[0]
    : searchParams.schoolId;

  const initialLocationRef = useRef<Coordinates>({
    latitude: Number.isFinite(Number(searchParams.lat))
      ? Number(searchParams.lat)
      : 41.8268,
    longitude: Number.isFinite(Number(searchParams.lng))
      ? Number(searchParams.lng)
      : -71.401,
  });
  const [selectedLocation, setSelectedLocation] = useState<Coordinates>(
    initialLocationRef.current
  );

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [locationPickerStatus, setLocationPickerStatus] =
    useState<LocationPickerStatus>('loading');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [touched, setTouched] = useState({
    image: false,
    name: false,
    description: false,
  });

  const interactionTimeoutRef = useRef<number | null>(null);
  const allowRemovalRef = useRef(false);

  const addSpot = useSpotsStore((s) => s.addSpot);
  const session = useAuthStore((s) => s.session);

  const isFormValid = isAddSpotFormValid(imageUri, name, description);
  const isSaveDisabled = saving;
  const formErrors = getSpotFormErrors(imageUri, name, description);
  const showImageError = hasSubmitted || touched.image;
  const showNameError = hasSubmitted || touched.name;
  const showDescriptionError = hasSubmitted || touched.description;
  const locationError =
    locationPickerStatus === 'error'
      ? 'Location map is unavailable. Retry it before saving.'
      : 'Wait for the location map to finish loading.';
  const hasUnsavedChanges =
    imageUri !== undefined ||
    name.length > 0 ||
    description.length > 0 ||
    selectedLocation.latitude !== initialLocationRef.current.latitude ||
    selectedLocation.longitude !== initialLocationRef.current.longitude;

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!hasUnsavedChanges || allowRemovalRef.current) {
        allowRemovalRef.current = false;
        return;
      }

      event.preventDefault();
      Alert.alert(
        'Discard unsaved changes?',
        'Your changes to this spot will be lost if you leave now.',
        [
          {
            text: 'Keep editing',
            style: 'cancel',
          },
          {
            text: 'Discard changes',
            style: 'destructive',
            onPress: () => {
              allowRemovalRef.current = true;
              navigation.dispatch(event.data.action);
            },
          },
        ],
        { cancelable: true }
      );
    });

    return unsubscribe;
  }, [hasUnsavedChanges, navigation]);

  const handleImageSelected = (asset: SpotImageAsset) => {
    setTouched((current) => ({ ...current, image: true }));
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
    setHasSubmitted(true);
    setTouched({ image: true, name: true, description: true });
    setSaveError(null);

    if (!isFormValid || locationPickerStatus !== 'ready' || saving) {
      triggerHaptic('warning');
      return;
    }

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
      triggerHaptic('success');
      // Success returns to the map, which refetches on focus (Req 10.4).
      allowRemovalRef.current = true;
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
    <SafeAreaView
      edges={['left', 'right']}
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
    >
      <ScreenHeader title="Add spot" onBack={() => router.back()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerClassName="w-full max-w-[720px] self-center px-5 pb-10 pt-4"
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
        >
        <View className="mb-2 flex-row items-baseline">
          <Text
            nativeID="spot-name-label"
            className="font-outfit-bold text-base text-ink"
          >
            Spot name
          </Text>
          <Text className="ml-2 font-outfit-medium text-xs text-muted">Required</Text>
        </View>
        <TextInput
          className={`min-h-14 rounded-2xl border bg-surface px-[18px] py-4 font-outfit-medium text-base text-ink ${
            showNameError && formErrors.name
              ? 'border-errorBorder'
              : 'border-border-soft'
          }`}
          placeholder="e.g. Library five-stair"
          placeholderTextColor="#52645F"
          accessibilityLabelledBy="spot-name-label"
          accessibilityHint="Enter a short name for this skate spot"
          value={name}
          maxLength={SPOT_NAME_MAX}
          onBlur={() => setTouched((current) => ({ ...current, name: true }))}
          onChangeText={setName}
        />
        <View className="mt-1 min-h-5 flex-row items-start justify-between">
          <Text
            accessibilityLiveRegion="polite"
            className="flex-1 pr-3 font-outfit-medium text-sm text-errorText"
          >
            {showNameError && formErrors.name ? formErrors.name : ' '}
          </Text>
          <Text
            className="font-outfit-medium text-xs text-muted"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {name.length} / {SPOT_NAME_MAX}
          </Text>
        </View>

        <View className="mb-2 mt-5 flex-row items-baseline">
          <Text className="font-outfit-bold text-base text-ink">Spot photo</Text>
          <Text className="ml-2 font-outfit-medium text-xs text-muted">Required</Text>
        </View>
        <SpotImagePicker
          imageUri={imageUri}
          onImageSelected={handleImageSelected}
        />
        {showImageError && formErrors.image ? (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="mt-2 font-outfit-medium text-sm text-errorText"
          >
            {formErrors.image}
          </Text>
        ) : null}

        <View className="mb-2 mt-5 flex-row items-baseline">
          <Text
            nativeID="spot-description-label"
            className="font-outfit-bold text-base text-ink"
          >
            Description
          </Text>
          <Text className="ml-2 font-outfit-medium text-xs text-muted">Required</Text>
        </View>
        <TextInput
          className={`min-h-32 rounded-2xl border bg-surface px-[18px] py-4 font-outfit-medium text-base text-ink ${
            showDescriptionError && formErrors.description
              ? 'border-errorBorder'
              : 'border-border-soft'
          }`}
          placeholder="Describe the obstacle, condition, and security…"
          placeholderTextColor="#52645F"
          accessibilityLabelledBy="spot-description-label"
          accessibilityHint="Describe the obstacle, condition, and security details"
          multiline
          maxLength={SPOT_DESCRIPTION_MAX}
          textAlignVertical="top"
          value={description}
          onBlur={() => setTouched((current) => ({ ...current, description: true }))}
          onChangeText={setDescription}
        />
        <View className="mt-1 min-h-5 flex-row items-start justify-between">
          <Text
            accessibilityLiveRegion="polite"
            className="flex-1 pr-3 font-outfit-medium text-sm text-errorText"
          >
            {showDescriptionError && formErrors.description ? formErrors.description : ' '}
          </Text>
          <Text
            className="font-outfit-medium text-xs text-muted"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {description.length} / {SPOT_DESCRIPTION_MAX}
          </Text>
        </View>

        <Text className="mb-2 mt-5 font-outfit-bold text-base text-ink">
          Location
        </Text>

        <Text className="mb-3 font-outfit-medium text-sm leading-5 text-muted">
          Move the map until the pin is directly over the skate spot.
        </Text>

        <View className="overflow-hidden">
          <LocationPicker
            initialLatitude={selectedLocation.latitude}
            initialLongitude={selectedLocation.longitude}
            initialLayer={layer}
            onLocationChange={handleLocationChange}
            onStatusChange={(status) => setLocationPickerStatus(status)}
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
          {locationPickerStatus === 'ready' ? (
            <View
              accessible
              accessibilityLiveRegion="polite"
              className="-mt-4 mb-3 flex-row items-center rounded-xl bg-surface-tinted px-3 py-2.5"
            >
              <Text className="font-outfit-bold text-sm text-brand">
                ✓ Location selected
              </Text>
            </View>
          ) : hasSubmitted ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="-mt-4 mb-3 text-sm text-errorText"
            >
              {locationError}
            </Text>
          ) : null}
        </View>

        {saveError ? (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="mb-3 text-center text-sm text-errorText">
            {saveError}
          </Text>
        ) : null}

        <FeedbackPressable
          haptic="light"
          onPress={handleSave}
          disabled={isSaveDisabled}
          className={`min-h-14 items-center justify-center rounded-2xl px-5 py-4 ${
            isSaveDisabled ? 'bg-disabledGreen' : 'bg-brand'
          }`}
          accessibilityRole="button"
          accessibilityLabel={saving ? 'Saving spot' : 'Save spot'}
          accessibilityHint={
            !isFormValid || locationPickerStatus !== 'ready'
              ? 'Checks the form and highlights anything that needs attention'
              : undefined
          }
          accessibilityState={{ disabled: isSaveDisabled, busy: saving }}
        >
          <View className="flex-row items-center">
            {saving ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text className="ml-2 font-outfit-bold text-lg text-white">
                  Saving…
                </Text>
              </>
            ) : (
              <>
                <Text className="font-outfit-bold text-lg text-white">
                  Save spot
                </Text>
                <Feather name="chevron-right" size={20} color="#FFFFFF" />
              </>
            )}
          </View>
        </FeedbackPressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
