import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
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
import SpotSocialNotice from '../components/spot-social-notice';
import { colors } from '../constants/colors';
import {
    getSpotFormErrors,
    getSpotFormMissingSummary,
    isAddSpotFormValid,
    SPOT_DESCRIPTION_MAX,
    SPOT_NAME_MAX,
} from '../lib/addSpotForm';
import { triggerHaptic } from '../lib/haptics';
import {
    draftImagesToMedia,
    isMeaningfulDraftContent,
    mediaToDraftImages,
} from '../lib/spotDraft';
import { filterExistingDraftImages } from '../lib/spotDraftFiles';
import { mediaListsEqual } from '../lib/spotMedia';
import { toUserFacingError } from '../lib/userFacingError';
import { useAuthStore } from '../store/authStore';
import { useDraftSpotsStore } from '../store/draftSpotsStore';
import { useMapViewStore } from '../store/mapViewStore';
import { useSpotsStore } from '../store/spotsStore';
import type { SpotMediaItem } from '../types/spot';

type Coordinates = {
  latitude: number;
  longitude: number;
};

const AUTH_REQUIRED_ERROR = 'Sign in to add a spot.';
const MISSING_SCHOOL_ERROR =
  'This needs a campus. Go back to the map and try again.';
const DRAFT_AUTOSAVE_MS = 400;

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}

function parseCoordinate(
  value: string | string[] | undefined,
  fallback: number
): number {
  const parsed = Number(firstParam(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function coordinatesDiffer(left: Coordinates, right: Coordinates): boolean {
  return (
    Math.abs(left.latitude - right.latitude) > 1e-5 ||
    Math.abs(left.longitude - right.longitude) > 1e-5
  );
}

export default function AddSpotScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const searchParams = useLocalSearchParams();

  const draftIdParam = firstParam(searchParams.draftId);
  const schoolIdParam = firstParam(searchParams.schoolId);
  const schoolNameParam = firstParam(searchParams.schoolName);

  const [media, setMedia] = useState<SpotMediaItem[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [resolvedSchoolId, setResolvedSchoolId] = useState(schoolIdParam);
  const [resolvedSchoolName, setResolvedSchoolName] = useState(
    schoolNameParam ?? ''
  );
  const [activeDraftId, setActiveDraftId] = useState(draftIdParam);
  const [draftReady, setDraftReady] = useState(!draftIdParam);

  const sharedMapLayer = useMapViewStore((state) => state.mapLayer);
  const layer =
    searchParams.layer === 'satellite' || searchParams.layer === 'default'
      ? searchParams.layer
      : sharedMapLayer;

  const initialLocationRef = useRef<Coordinates>({
    latitude: parseCoordinate(searchParams.lat, 41.8268),
    longitude: parseCoordinate(searchParams.lng, -71.401),
  });
  const [selectedLocation, setSelectedLocation] = useState<Coordinates>(
    initialLocationRef.current
  );

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [locationPickerStatus, setLocationPickerStatus] =
    useState<LocationPickerStatus>('loading');
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const interactionTimeoutRef = useRef<number | null>(null);
  const allowRemovalRef = useRef(false);
  const postedRef = useRef(false);
  const savingRef = useRef(false);
  const draftIdRef = useRef(draftIdParam);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistInFlightRef = useRef<Promise<void> | null>(null);

  const addSpot = useSpotsStore((s) => s.addSpot);
  const session = useAuthStore((s) => s.session);
  const hasHydratedDrafts = useDraftSpotsStore((s) => s.hasHydrated);
  const getDraft = useDraftSpotsStore((s) => s.getDraft);
  const upsertDraft = useDraftSpotsStore((s) => s.upsertDraft);
  const deleteDraft = useDraftSpotsStore((s) => s.deleteDraft);

  const locationChanged = coordinatesDiffer(
    selectedLocation,
    initialLocationRef.current
  );
  const hasMeaningfulContent = isMeaningfulDraftContent({
    name,
    description,
    imageCount: media.length,
    locationChanged,
  });
  const canSaveDraft = Boolean(activeDraftId) || hasMeaningfulContent;
  const isFormValid = isAddSpotFormValid(media.length, name, description);
  const isSaveDisabled = saving;
  const formErrors = getSpotFormErrors(media.length, name, description);
  const missingSummary = getSpotFormMissingSummary(media.length, name, description);
  const showFieldErrors = hasSubmitted;
  const locationError =
    locationPickerStatus === 'error'
      ? 'The map didn’t load. Please retry it, then submit.'
      : 'The map is still loading.';

  const formRef = useRef({
    media,
    name,
    description,
    selectedLocation,
    resolvedSchoolId,
    resolvedSchoolName,
    userId: session?.user?.id,
  });
  formRef.current = {
    media,
    name,
    description,
    selectedLocation,
    resolvedSchoolId,
    resolvedSchoolName,
    userId: session?.user?.id,
  };

  useEffect(() => {
    draftIdRef.current = activeDraftId;
  }, [activeDraftId]);

  useEffect(() => {
    if (!draftIdParam) {
      setDraftReady(true);
      return;
    }
    if (!hasHydratedDrafts) {
      return;
    }

    let cancelled = false;

    const loadDraft = async () => {
      const draft = getDraft(draftIdParam);
      if (!draft) {
        if (!cancelled) {
          setDraftReady(true);
        }
        return;
      }

      const images = await filterExistingDraftImages(draft.images);
      if (cancelled) {
        return;
      }

      const location = {
        latitude: draft.latitude,
        longitude: draft.longitude,
      };
      initialLocationRef.current = location;
      setSelectedLocation(location);
      setName(draft.name);
      setDescription(draft.description);
      setMedia(draftImagesToMedia(images));
      setResolvedSchoolId(draft.schoolId);
      setResolvedSchoolName(draft.schoolName);
      setActiveDraftId(draft.id);
      setDraftReady(true);
    };

    void loadDraft();

    return () => {
      cancelled = true;
    };
  }, [draftIdParam, getDraft, hasHydratedDrafts]);

  const persistDraftNow = useCallback(async () => {
    if (postedRef.current) {
      return;
    }

    const form = formRef.current;
    const userId = form.userId;
    const schoolId = form.resolvedSchoolId;
    const locationMoved = coordinatesDiffer(
      form.selectedLocation,
      initialLocationRef.current
    );
    const shouldSave =
      Boolean(draftIdRef.current) ||
      isMeaningfulDraftContent({
        name: form.name,
        description: form.description,
        imageCount: form.media.length,
        locationChanged: locationMoved,
      });

    if (!userId || !schoolId || !shouldSave) {
      return;
    }

    const run = (async () => {
      const draft = await upsertDraft({
        id: draftIdRef.current,
        userId,
        schoolId,
        schoolName: form.resolvedSchoolName || 'Campus map',
        name: form.name,
        description: form.description,
        latitude: form.selectedLocation.latitude,
        longitude: form.selectedLocation.longitude,
        images: mediaToDraftImages(form.media),
      });
      draftIdRef.current = draft.id;
      setActiveDraftId(draft.id);
      const nextMedia = draftImagesToMedia(draft.images);
      if (!mediaListsEqual(form.media, nextMedia)) {
        setMedia(nextMedia);
      }
    })();

    persistInFlightRef.current = run;
    try {
      await run;
    } catch (error) {
      console.warn('Could not save the spot draft.', error);
    } finally {
      if (persistInFlightRef.current === run) {
        persistInFlightRef.current = null;
      }
    }
  }, [upsertDraft]);

  useEffect(() => {
    if (!draftReady || saving || postedRef.current) {
      return;
    }

    debounceRef.current = setTimeout(() => {
      void persistDraftNow();
    }, DRAFT_AUTOSAVE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [
    description,
    draftReady,
    media,
    name,
    persistDraftNow,
    saving,
    selectedLocation.latitude,
    selectedLocation.longitude,
  ]);

  const flushDraftAndLeave = useCallback(
    async (action?: { type: string }) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      await persistDraftNow();
      allowRemovalRef.current = true;
      if (action) {
        navigation.dispatch(action);
        return;
      }
      router.back();
    },
    [navigation, persistDraftNow, router]
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

      if (postedRef.current) {
        return;
      }

      const form = formRef.current;
      const locationMoved = coordinatesDiffer(
        form.selectedLocation,
        initialLocationRef.current
      );
      const shouldPersist =
        Boolean(draftIdRef.current) ||
        isMeaningfulDraftContent({
          name: form.name,
          description: form.description,
          imageCount: form.media.length,
          locationChanged: locationMoved,
        });

      if (!shouldPersist) {
        return;
      }

      event.preventDefault();
      void flushDraftAndLeave(event.data.action);
    });

    return unsubscribe;
  }, [flushDraftAndLeave, navigation, saving]);

  const handleLocationChange = useCallback(
    (latitude: number, longitude: number) => {
      setSelectedLocation({ latitude, longitude });
    },
    []
  );

  const handleSaveDraft = () => {
    if (saving || !canSaveDraft) {
      return;
    }

    triggerHaptic('light');
    void flushDraftAndLeave();
  };

  const handlePost = async () => {
    if (savingRef.current || postedRef.current || submitted) {
      return;
    }

    setHasSubmitted(true);
    setSaveError(null);

    if (!isFormValid || locationPickerStatus !== 'ready') {
      triggerHaptic('warning');
      if (isFormValid && locationPickerStatus !== 'ready') {
        setSaveError(locationError);
      }
      return;
    }

    const schoolId = resolvedSchoolId;
    if (!schoolId) {
      setSaveError(MISSING_SCHOOL_ERROR);
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      setSaveError(AUTH_REQUIRED_ERROR);
      return;
    }

    savingRef.current = true;
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
          images: media
            .filter((item) => item.kind === 'new')
            .map((item) => item.asset),
        },
        accessToken
      );
      postedRef.current = true;
      if (draftIdRef.current) {
        try {
          await deleteDraft(draftIdRef.current);
        } catch (error) {
          console.warn('Could not remove the local draft after posting.', error);
        }
      }
      triggerHaptic('success');
      allowRemovalRef.current = true;
      setSubmitted(true);
    } catch (error) {
      setSaveError(
        toUserFacingError(error, 'We couldn’t submit this spot. Please try again.')
      );
    } finally {
      savingRef.current = postedRef.current;
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
        title={submitted ? 'Submitted' : activeDraftId ? 'Draft' : 'Add spot'}
        onBack={() => {
          if (submitted) {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace('/');
            return;
          }
          router.back();
        }}
        backDisabled={saving && !submitted}
      />

      {!draftReady ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Loading draft"
          className="flex-1 items-center justify-center px-6"
        >
          <ActivityIndicator size="small" color={colors.ink} />
          <Text className="mt-2 font-outfit-medium text-sm text-muted">
            Loading draft…
          </Text>
        </View>
      ) : submitted ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-[520px] items-center">
            <Text
              accessibilityRole="header"
              className="text-center font-outfit-black text-2xl text-ink"
            >
              Spot submitted for review.
            </Text>
            <Text className="mt-3 text-center font-outfit-medium text-base leading-6 text-muted">
              Your spot has been received. It may not appear on the map right away.
            </Text>
            <FeedbackPressable
              haptic="light"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                  return;
                }
                router.replace('/');
              }}
              className="mt-8 min-h-14 w-full items-center justify-center rounded-2xl bg-accent px-5 py-4"
              accessibilityRole="button"
              accessibilityLabel="Come back later"
            >
              <Text className="font-outfit-bold text-lg text-brand">
                Come back later
              </Text>
            </FeedbackPressable>
          </View>
        </View>
      ) : (
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
              editable={!saving}
              onChangeText={setName}
            />
          </View>
          {name.length > SPOT_NAME_MAX * 0.8 ? (
            <Text className="mt-1 self-end font-outfit-medium text-sm tabular-nums text-muted">
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
              className="min-h-32 w-full p-0 font-outfit-medium text-base text-ink"
              placeholder="What’s the spot like?"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Spot description"
              multiline
              maxLength={SPOT_DESCRIPTION_MAX}
              textAlignVertical="top"
              value={description}
              editable={!saving}
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

          <SpotSocialNotice action="posting" />

          <FeedbackPressable
            haptic="light"
            onPress={handlePost}
            disabled={isSaveDisabled}
            pressLockMs={800}
            className={`mt-6 min-h-14 items-center justify-center rounded-2xl px-5 py-4 ${
              isSaveDisabled ? 'bg-actionDisabled' : 'bg-accent'
            }`}
            accessibilityRole="button"
            accessibilityLabel={saving ? 'Submitting spot' : 'Submit spot'}
            accessibilityState={{ disabled: isSaveDisabled, busy: saving }}
          >
            {saving ? (
              <View className="flex-row items-center">
                <ActivityIndicator color={colors.muted} />
                <Text className="ml-2 font-outfit-bold text-lg text-muted">
                  Submitting spot…
                </Text>
              </View>
            ) : (
              <Text className="font-outfit-bold text-lg text-brand">
                Submit
              </Text>
            )}
          </FeedbackPressable>

          <FeedbackPressable
            haptic="light"
            onPress={handleSaveDraft}
            disabled={saving || !canSaveDraft}
            className="mt-3 min-h-12 items-center justify-center rounded-2xl px-5 py-3"
            accessibilityRole="button"
            accessibilityLabel="Save draft"
            accessibilityHint="Saves this spot on your phone without posting it"
            accessibilityState={{ disabled: saving || !canSaveDraft }}
          >
            <Text
              className={`font-outfit-bold text-base ${
                saving || !canSaveDraft ? 'text-muted' : 'text-ink'
              }`}
            >
              Save draft
            </Text>
          </FeedbackPressable>
        </ScrollView>
      </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
