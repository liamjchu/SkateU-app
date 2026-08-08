import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const AUTH_REQUIRED_ERROR = 'You must be signed in to edit a spot.';
const MISSING_SPOT_ERROR =
  'This spot could not be found. Return to your profile and try again.';

export default function EditSpotScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const searchParams = useLocalSearchParams();

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
  const locationError =
    locationPickerStatus === 'error'
      ? 'Location map is unavailable. Retry it before saving.'
      : 'Wait for the location map to finish loading.';
  const hasUnsavedChanges = Boolean(
    spot &&
      (name !== spot.name ||
        description !== spot.description ||
        imageChanged ||
        selectedLocation.latitude !== spot.latitude ||
        selectedLocation.longitude !== spot.longitude)
  );

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
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowRemovalRef.current) {
        allowRemovalRef.current = false;
        return;
      }

      if (saving) {
        event.preventDefault();
        return;
      }

      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      Alert.alert(
        'Discard unsaved changes?',
        'Your changes to this spot will be lost if you leave now.',
        [
          { text: 'Keep editing', style: 'cancel' },
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
  }, [hasUnsavedChanges, navigation, saving]);

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
    setTouched({ image: true, name: true, description: true });
    setSaveError(null);

    if (!isFormValid || locationPickerStatus !== 'ready' || saving || !spotId) {
      triggerHaptic('warning');
      return;
    }

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
      allowRemovalRef.current = true;
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
    <SafeAreaView
      edges={['left', 'right']}
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
    >
      <ScreenHeader
        title="Edit spot"
        onBack={() => router.back()}
        backDisabled={saving}
      />

      {!spot ? (
        <View
          accessible
          accessibilityRole={myLoading ? 'progressbar' : 'alert'}
          accessibilityLabel={myLoading ? 'Loading spot' : MISSING_SPOT_ERROR}
          className="flex-1 items-center justify-center px-8"
        >
          {myLoading ? <ActivityIndicator size="small" color="#21473F" /> : null}
          <Text className="mt-3 text-center font-outfit-medium text-base text-muted">
            {myLoading ? 'Loading spot…' : MISSING_SPOT_ERROR}
          </Text>
        </View>
      ) : (
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
              nativeID="edit-spot-name-label"
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
            accessibilityLabelledBy="edit-spot-name-label"
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
              nativeID="edit-spot-description-label"
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
            accessibilityLabelledBy="edit-spot-description-label"
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
              className="mb-3 mt-4 text-center text-sm text-errorText">
              {saveError}
            </Text>
          ) : null}

          <FeedbackPressable
            haptic="light"
            onPress={handleSave}
            disabled={saving}
            className={`mt-6 min-h-14 items-center justify-center rounded-2xl px-5 py-4 ${
              saving ? 'bg-disabledGreen' : 'bg-brand'
            }`}
            accessibilityRole="button"
            accessibilityLabel={saving ? 'Saving changes' : 'Save changes'}
            accessibilityHint={
              !isFormValid || locationPickerStatus !== 'ready'
                ? 'Checks the form and highlights anything that needs attention'
                : undefined
            }
            accessibilityState={{ disabled: saving, busy: saving }}
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
                    Save changes
                  </Text>
                  <Feather name="chevron-right" size={20} color="#FFFFFF" />
                </>
              )}
            </View>
          </FeedbackPressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
