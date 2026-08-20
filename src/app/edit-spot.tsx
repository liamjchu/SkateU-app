import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { existingMediaItems, mediaListsEqual } from '../lib/spotMedia';
import { toUserFacingError } from '../lib/userFacingError';
import { useAuthStore } from '../store/authStore';
import { useMapViewStore } from '../store/mapViewStore';
import { useSpotsStore } from '../store/spotsStore';
import type { SpotMediaItem } from '../types/spot';


type Coordinates = {
  latitude: number;
  longitude: number;
};

const AUTH_REQUIRED_ERROR = 'Sign in to edit a spot.';
const MISSING_SPOT_ERROR =
  'Couldn’t find this spot. Head back and try again.';

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
  const [media, setMedia] = useState<SpotMediaItem[]>(
    existingMediaItems(spot?.imageUris ?? [])
  );

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
    setMedia(existingMediaItems(spot.imageUris));
    setSelectedLocation({
      latitude: spot.latitude,
      longitude: spot.longitude,
    });
  }, [spot]);

  const originalMedia = existingMediaItems(spot?.imageUris ?? []);
  const mediaChanged = !mediaListsEqual(media, originalMedia);
  const isFormValid = isAddSpotFormValid(media.length, name, description);
  const formErrors = getSpotFormErrors(media.length, name, description);
  const missingSummary = getSpotFormMissingSummary(media.length, name, description);
  const showFieldErrors = hasSubmitted;
  const locationError =
    locationPickerStatus === 'error'
      ? 'Map didn’t load. Retry it, then save.'
      : 'Hang on, the map’s still loading.';
  const hasUnsavedChanges = Boolean(
    spot &&
      (name !== spot.name ||
        description !== spot.description ||
        mediaChanged ||
        selectedLocation.latitude !== spot.latitude ||
        selectedLocation.longitude !== spot.longitude)
  );

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
        'Leave without saving?',
        'You’ll lose these edits.',
        [
          { text: 'Stay', style: 'cancel' },
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
    setSaveError(null);

    if (!isFormValid || locationPickerStatus !== 'ready' || saving || !spotId) {
      triggerHaptic('warning');
      if (isFormValid && locationPickerStatus !== 'ready') {
        setSaveError(locationError);
      }
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
          media: mediaChanged ? media : undefined,
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

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={{ flex: 1, backgroundColor: colors.surface }}
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
          {myLoading ? <ActivityIndicator size="small" color={colors.accent} /> : null}
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
            contentContainerClassName="w-full max-w-[720px] self-center px-6 pb-10 pt-5"
            keyboardShouldPersistTaps="handled"
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
              className="w-full font-outfit-medium text-base text-ink"
              style={{ padding: 0 }}
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
            <Text
              className="mt-1 self-end font-outfit-medium text-sm text-muted"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {name.length}/{SPOT_NAME_MAX}
            </Text>
          ) : null}

          <Text className="mb-2 mt-6 font-outfit-bold text-base text-ink">
            Photos
          </Text>
          <SpotImagePicker
            items={media}
            onChange={setMedia}
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
              className="min-h-32 w-full font-outfit-medium text-base text-ink"
              style={{ padding: 0 }}
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
            <Text
              className="mt-1 self-end font-outfit-medium text-sm text-muted"
              style={{ fontVariant: ['tabular-nums'] }}
            >
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
            disabled={saving}
            className={`mt-6 min-h-14 items-center justify-center rounded-2xl px-5 py-4 ${
              saving ? 'bg-actionDisabled' : 'bg-accent'
            }`}
            accessibilityRole="button"
            accessibilityLabel={saving ? 'Saving changes' : 'Save changes'}
            accessibilityState={{ disabled: saving, busy: saving }}
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
                Save changes
              </Text>
            )}
          </FeedbackPressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
