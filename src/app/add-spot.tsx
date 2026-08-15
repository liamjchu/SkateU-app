import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
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
    getSpotFormMissingSummary,
    isAddSpotFormValid,
    SPOT_DESCRIPTION_MAX,
    SPOT_NAME_MAX,
} from '../lib/addSpotForm';
import { triggerHaptic } from '../lib/haptics';
import { colors } from '../constants/colors';
import { toUserFacingError } from '../lib/userFacingError';
import { useAuthStore } from '../store/authStore';
import { useMapViewStore } from '../store/mapViewStore';
import { useSpotsStore } from '../store/spotsStore';
import type { SpotImageAsset } from '../types/spot';

type Coordinates = {
  latitude: number;
  longitude: number;
};

const AUTH_REQUIRED_ERROR = 'Sign in to add a spot.';
const MISSING_SCHOOL_ERROR =
  'This needs a campus. Head back to the map and try again.';

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

  const interactionTimeoutRef = useRef<number | null>(null);
  const allowRemovalRef = useRef(false);

  const addSpot = useSpotsStore((s) => s.addSpot);
  const session = useAuthStore((s) => s.session);

  const isFormValid = isAddSpotFormValid(imageUri, name, description);
  const isSaveDisabled = saving;
  const formErrors = getSpotFormErrors(imageUri, name, description);
  const missingSummary = getSpotFormMissingSummary(imageUri, name, description);
  const showFieldErrors = hasSubmitted;
  const locationError =
    locationPickerStatus === 'error'
      ? 'Map didn’t load. Retry it, then save.'
      : 'Hang on, the map’s still loading.';
  const hasUnsavedChanges =
    imageUri !== undefined ||
    name.trim().length > 0 ||
    description.trim().length > 0 ||
    selectedLocation.latitude !== initialLocationRef.current.latitude ||
    selectedLocation.longitude !== initialLocationRef.current.longitude;

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
        'Leave without saving?',
        'You’ll lose what you added.',
        [
          {
            text: 'Stay',
            style: 'cancel',
          },
          {
            text: 'Leave',
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
    setHasSubmitted(true);
    setSaveError(null);

    if (!isFormValid || locationPickerStatus !== 'ready' || saving) {
      triggerHaptic('warning');
      if (isFormValid && locationPickerStatus !== 'ready') {
        setSaveError(locationError);
      }
      return;
    }

    if (!schoolId) {
      setSaveError(MISSING_SCHOOL_ERROR);
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
      allowRemovalRef.current = true;
      router.back();
    } catch (error) {
      setSaveError(
        toUserFacingError(error, 'Couldn’t save that. Try again in a sec.')
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
      style={{ flex: 1, backgroundColor: colors.surface }}
    >
      <ScreenHeader
        title="Add spot"
        onBack={() => router.back()}
        backDisabled={saving}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerClassName="w-full max-w-[720px] self-center px-6 pb-10 pt-5"
          keyboardShouldPersistTaps="never"
          keyboardDismissMode="interactive"
          onScrollBeginDrag={Keyboard.dismiss}
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
        >
          <Text className="mb-2 font-outfit-bold text-base text-ink">Name</Text>
          <View
            className={`min-h-14 justify-center rounded-2xl border bg-field px-5 ${
              showFieldErrors && formErrors.name
                ? 'border-errorBorder'
                : 'border-border-soft'
            }`}
          >
            <TextInput
              className="w-full p-0 font-outfit-medium text-base text-ink"
              placeholder="Library five-stair"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Spot name"
              value={name}
              maxLength={SPOT_NAME_MAX}
              returnKeyType="next"
              blurOnSubmit
              onChangeText={setName}
            />
          </View>
          {name.length > SPOT_NAME_MAX * 0.8 ? (
            <Text className="mt-1 self-end font-outfit-medium text-sm tabular-nums text-muted">
              {name.length}/{SPOT_NAME_MAX}
            </Text>
          ) : null}

          <Text className="mb-2 mt-6 font-outfit-bold text-base text-ink">
            Photo
          </Text>
          <SpotImagePicker
            imageUri={imageUri}
            onImageSelected={handleImageSelected}
            highlighted={Boolean(showFieldErrors && formErrors.image)}
          />

          <Text className="mb-2 mt-6 font-outfit-bold text-base text-ink">
            About
          </Text>
          <View
            className={`rounded-2xl border bg-field px-5 py-4 ${
              showFieldErrors && formErrors.description
                ? 'border-errorBorder'
                : 'border-border-soft'
            }`}
          >
            <TextInput
              className="min-h-32 w-full p-0 font-outfit-medium text-base text-ink"
              placeholder="What’s the spot like?"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Spot description"
              multiline
              maxLength={SPOT_DESCRIPTION_MAX}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>
          {description.length > SPOT_DESCRIPTION_MAX * 0.8 ? (
            <Text className="mt-1 self-end font-outfit-medium text-sm tabular-nums text-muted">
              {description.length}/{SPOT_DESCRIPTION_MAX}
            </Text>
          ) : null}

          <Text className="mb-2 mt-6 font-outfit-bold text-base text-ink">
            Location
          </Text>
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

          {hasSubmitted && (missingSummary || saveError) ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="mt-4 text-center font-outfit-medium text-base text-errorText"
            >
              {saveError ?? missingSummary}
            </Text>
          ) : null}

          <FeedbackPressable
            haptic="light"
            onPress={handleSave}
            disabled={isSaveDisabled}
            className={`mt-6 min-h-14 items-center justify-center rounded-2xl px-5 py-4 ${
              isSaveDisabled ? 'bg-actionDisabled' : 'bg-accent'
            }`}
            accessibilityRole="button"
            accessibilityLabel={saving ? 'Saving spot' : 'Save spot'}
            accessibilityState={{ disabled: isSaveDisabled, busy: saving }}
          >
            {saving ? (
              <View className="flex-row items-center">
                <ActivityIndicator color={colors.muted} />
                <Text className="ml-2 font-outfit-bold text-lg text-muted">
                  Saving…
                </Text>
              </View>
            ) : (
              <Text className="font-outfit-bold text-lg text-brand">
                Save spot
              </Text>
            )}
          </FeedbackPressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
