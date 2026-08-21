import { Feather, Octicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    Text,
    View
} from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import ExpandableText from '../components/expandable-text';
import FeedbackPressable from '../components/FeedbackPressable';
import ScreenHeader from '../components/screen-header';
import SocialLinks from '../components/social-links';
import { colors } from '../constants/colors';
import { triggerHaptic } from '../lib/haptics';
import { formatRelativeTime } from '../lib/relativeTime';
import { draftsForUser, getDraftStatusHint } from '../lib/spotDraft';
import { toUserFacingError } from '../lib/userFacingError';
import { guardedNavigate } from '../lib/navigationGuard';
import { useAuthStore } from '../store/authStore';
import { useDraftSpotsStore } from '../store/draftSpotsStore';
import { useProfileStore } from '../store/profileStore';
import { useSpotsStore } from '../store/spotsStore';
import type { Spot } from '../types/spot';
import type { SpotDraft } from '../types/spotDraft';

type ProfileSpotTab = 'created' | 'liked' | 'drafts';
const PROFILE_TAB_COUNT = 3;

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}

function tabFromParam(value: string | string[] | undefined): ProfileSpotTab {
  return firstParam(value) === 'drafts' ? 'drafts' : 'created';
}

export default function ProfileScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const username = useProfileStore((state) => state.profile?.username ?? '');

  const mySpots = useSpotsStore((state) => state.mySpots);
  const myLoading = useSpotsStore((state) => state.myLoading);
  const myError = useSpotsStore((state) => state.myError);
  const fetchMySpots = useSpotsStore((state) => state.fetchMySpots);
  const likedSpots = useSpotsStore((state) => state.likedSpots);
  const likedLoading = useSpotsStore((state) => state.likedLoading);
  const likedError = useSpotsStore((state) => state.likedError);
  const fetchLikedSpots = useSpotsStore((state) => state.fetchLikedSpots);
  const deleteSpot = useSpotsStore((state) => state.deleteSpot);
  const toggleSpotLike = useSpotsStore((state) => state.toggleSpotLike);
  const allDrafts = useDraftSpotsStore((state) => state.drafts);
  const hasHydratedDrafts = useDraftSpotsStore((state) => state.hasHydrated);
  const deleteDraft = useDraftSpotsStore((state) => state.deleteDraft);
  const drafts = useMemo(
    () => (user?.id ? draftsForUser(allDrafts, user.id) : []),
    [allDrafts, user?.id]
  );

  const [spotTab, setSpotTab] = useState<ProfileSpotTab>(() =>
    tabFromParam(searchParams.tab)
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);
  const spotToggleWidth = useSharedValue(0);
  const showingLikedSpots = spotTab === 'liked';
  const showingDrafts = spotTab === 'drafts';
  const tabIndex = showingDrafts ? 2 : showingLikedSpots ? 1 : 0;
  const spotToggleIndicatorStyle = useAnimatedStyle(() => {
    const optionWidth = Math.max(spotToggleWidth.value - 8, 0) / PROFILE_TAB_COUNT;

    return {
      width: optionWidth,
      transform: [
        {
          translateX: withTiming(tabIndex * optionWidth, {
            duration: reduceMotion ? 0 : 180,
            easing: Easing.out(Easing.cubic),
          }),
        },
      ],
    };
  });

  useEffect(() => {
    const nextTab = tabFromParam(searchParams.tab);
    if (nextTab === 'drafts') {
      setSpotTab('drafts');
    }
  }, [searchParams.tab]);

  const email = user?.email ?? '';

  // Load the user's spots whenever the screen regains focus, so edits/deletes
  // made on the edit screen are reflected on return.
  useFocusEffect(
    useCallback(() => {
      const accessToken = session?.access_token;
      if (accessToken) {
        fetchMySpots(accessToken);
        fetchLikedSpots(accessToken);
      }
    }, [fetchLikedSpots, fetchMySpots, session?.access_token])
  );

  const displayedSpots = showingLikedSpots ? likedSpots : mySpots;
  const displayedLoading = showingLikedSpots ? likedLoading : myLoading;
  const displayedError = showingLikedSpots ? likedError : myError;

  const handleSpotTab = (tab: ProfileSpotTab) => {
    if (spotTab === tab) {
      return;
    }

    setSpotTab(tab);
    triggerHaptic('selection');
  };

  const handleDraftPress = (draft: SpotDraft) => {
    guardedNavigate(`add-spot-draft:${draft.id}`, () => {
      router.push({
        pathname: '/add-spot',
        params: {
          draftId: draft.id,
          schoolId: draft.schoolId,
          schoolName: draft.schoolName,
          lat: draft.latitude.toString(),
          lng: draft.longitude.toString(),
        },
      });
    });
  };

  const handleDeleteDraft = (draft: SpotDraft) => {
    triggerHaptic('warning');
    const title = draft.name.trim() || 'Untitled spot';
    Alert.alert(
      'Delete this draft?',
      `"${title}" only lives on this phone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteDraft(draft.id);
          },
        },
      ]
    );
  };

  const handleSpotPress = (spot: Spot) => {
    if (!spot.schoolId) {
      Alert.alert(
        'Campus map unavailable',
        'This spot is not tied to a campus, so there is no map to open.'
      );
      return;
    }

    guardedNavigate(`map-spot:${spot.id}`, () => {
      router.push({
        pathname: '/map',
        params: {
          lat: spot.latitude.toString(),
          lng: spot.longitude.toString(),
          schoolId: spot.schoolId,
          schoolName: spot.schoolName || 'Campus map',
          schoolCity: spot.city,
          schoolState: spot.state,
          spotId: spot.id,
        },
      });
    });
  };

  const handleUnlike = async (spot: Spot) => {
    const accessToken = session?.access_token;
    if (!accessToken || likingId) {
      return;
    }

    setLikingId(spot.id);
    try {
      await toggleSpotLike(spot.id, true, accessToken);
    } catch (error) {
      Alert.alert(
        'Couldn’t unlike that spot',
        toUserFacingError(error, 'Try again in a sec.')
      );
    } finally {
      setLikingId(null);
    }
  };

  const handleRetryDisplayedSpots = () => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      Alert.alert('Sign in again', 'Sign in again to refresh your spots.');
      return;
    }

    if (showingLikedSpots) {
      fetchLikedSpots(accessToken);
    } else {
      fetchMySpots(accessToken);
    }
  };

  const handleEdit = (spot: Spot) => {
    guardedNavigate(`edit-spot:${spot.id}`, () => {
      router.push(`/edit-spot?id=${encodeURIComponent(spot.id)}`);
    });
  };

  const handleDelete = (spot: Spot) => {
    triggerHaptic('warning');
    Alert.alert(
      'Delete this spot?',
      `"${spot.name}" will be gone for everyone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const accessToken = session?.access_token;
            if (!accessToken) {
              Alert.alert('Sign in to delete a spot.');
              return;
            }

            setDeletingId(spot.id);

            try {
              await deleteSpot(spot.id, accessToken);
            } catch (error) {
              Alert.alert(
                'Couldn’t delete that spot',
                toUserFacingError(error, 'Try again in a sec.')
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        title="Profile"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }

          router.replace('/');
        }}
        rightAction={
          <FeedbackPressable
            haptic="light"
            onPress={() =>
              guardedNavigate('settings', () => {
                router.push('/settings');
              })
            }
            className="h-12 w-12 items-center justify-center rounded-full"
            accessibilityLabel="Open settings"
            accessibilityRole="button"
          >
            <Feather name="settings" size={23} color="#FFFFFF" />
          </FeedbackPressable>
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="self-center w-full max-w-[720px] px-6 pb-10 pt-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center rounded-2xl bg-field p-6">
          <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-accent">
            <Feather name="user" size={40} color={colors.brand} />
          </View>

          <Text
            className="max-w-full px-4 text-center font-outfit-black text-2xl text-ink"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {username ? `@${username}` : 'Your Profile'}
          </Text>

          {email ? (
            <Text
              selectable
              className="mt-1 max-w-full px-4 text-center font-outfit-medium text-base text-muted"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {email}
            </Text>
          ) : null}
        </View>

        <View
          className="relative mt-8 flex-row rounded-2xl bg-surface-soft p-1"
          onLayout={(event) => {
            spotToggleWidth.value = event.nativeEvent.layout.width;
          }}
        >
            <Animated.View
              pointerEvents="none"
              className="absolute rounded-xl bg-accent"
              style={[
                {
                  left: 4,
                  top: 4,
                  bottom: 4,
                },
                spotToggleIndicatorStyle,
              ]}
            />
          <FeedbackPressable
            onPress={() => handleSpotTab('created')}
            className="z-10 min-h-12 flex-1 items-center justify-center rounded-xl py-3"
            accessibilityRole="tab"
            accessibilityLabel={`Your spots${mySpots.length > 0 ? `, ${mySpots.length}` : ''}`}
            accessibilityState={{ selected: spotTab === 'created' }}
          >
            <Text
              className={`font-outfit-bold text-xs ${
                spotTab === 'created' ? 'text-brand' : 'text-muted'
              }`}
              numberOfLines={1}
            >
              Yours {mySpots.length > 0 ? `(${mySpots.length})` : ''}
            </Text>
          </FeedbackPressable>
          <FeedbackPressable
            onPress={() => handleSpotTab('liked')}
            className="z-10 min-h-12 flex-1 items-center justify-center rounded-xl py-3"
            accessibilityRole="tab"
            accessibilityLabel={`Liked spots${likedSpots.length > 0 ? `, ${likedSpots.length}` : ''}`}
            accessibilityState={{ selected: showingLikedSpots }}
          >
            <Text
              className={`font-outfit-bold text-xs ${
                showingLikedSpots ? 'text-brand' : 'text-muted'
              }`}
              numberOfLines={1}
            >
              Liked {likedSpots.length > 0 ? `(${likedSpots.length})` : ''}
            </Text>
          </FeedbackPressable>
          <FeedbackPressable
            onPress={() => handleSpotTab('drafts')}
            className="z-10 min-h-12 flex-1 items-center justify-center rounded-xl py-3"
            accessibilityRole="tab"
            accessibilityLabel={`Drafts${drafts.length > 0 ? `, ${drafts.length}` : ''}`}
            accessibilityState={{ selected: showingDrafts }}
          >
            <Text
              className={`font-outfit-bold text-xs ${
                showingDrafts ? 'text-brand' : 'text-muted'
              }`}
              numberOfLines={1}
            >
              Drafts {drafts.length > 0 ? `(${drafts.length})` : ''}
            </Text>
          </FeedbackPressable>
        </View>

        {showingDrafts ? (
          !hasHydratedDrafts ? (
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Loading drafts"
              className="mt-6 items-center rounded-2xl bg-field px-4 py-6"
            >
              <ActivityIndicator size="small" color={colors.ink} />
              <Text className="mt-2 font-outfit-medium text-sm text-muted">
                Loading drafts…
              </Text>
            </View>
          ) : drafts.length === 0 ? (
            <View className="mt-4 rounded-2xl bg-field p-6">
              <Text className="font-outfit-medium text-center text-sm text-muted">
                Drafts live on this phone until you post them. Hit + on a campus
                map to start one.
              </Text>
            </View>
          ) : (
            <View className="mt-3">
              {drafts.map((draft) => {
                const title = draft.name.trim() || 'Untitled spot';
                const coverUri = draft.images[0]?.uri;
                const updatedLabel = formatRelativeTime(draft.updatedAt);

                return (
                  <View
                    key={draft.id}
                    className="mb-4 flex-row items-center rounded-2xl bg-field p-4"
                  >
                    <FeedbackPressable
                      onPress={() => handleDraftPress(draft)}
                      accessibilityRole="button"
                      accessibilityLabel={`Continue draft ${title}`}
                      accessibilityHint="Opens this draft so you can keep editing"
                    >
                      {coverUri ? (
                        <Image
                          source={{ uri: coverUri }}
                          className="h-16 w-16 rounded-xl"
                          resizeMode="cover"
                          accessible={false}
                        />
                      ) : (
                        <View
                          accessible={false}
                          importantForAccessibility="no-hide-descendants"
                          className="h-16 w-16 items-center justify-center rounded-xl bg-surface-soft"
                        >
                          <Feather name="edit-3" size={20} color={colors.muted} />
                        </View>
                      )}
                    </FeedbackPressable>

                    <FeedbackPressable
                      onPress={() => handleDraftPress(draft)}
                      className="ml-3 min-w-0 flex-1"
                      accessibilityRole="button"
                      accessibilityLabel={`Continue draft ${title}`}
                    >
                      <Text
                        className="font-outfit-bold text-base text-ink"
                        numberOfLines={1}
                      >
                        {title}
                      </Text>
                      <Text
                        className="mt-0.5 font-outfit-semibold text-xs text-muted-soft"
                        numberOfLines={1}
                      >
                        {draft.schoolName || 'Campus map'}
                        {updatedLabel ? ` · ${updatedLabel}` : ''}
                      </Text>
                      <Text className="mt-0.5 font-outfit-medium text-sm text-muted">
                        {getDraftStatusHint(draft)}
                      </Text>
                    </FeedbackPressable>

                    <FeedbackPressable
                      onPress={() => handleDeleteDraft(draft)}
                      className="ml-2 h-12 w-12 items-center justify-center rounded-full"
                      accessibilityLabel={`Delete draft ${title}`}
                      accessibilityRole="button"
                    >
                      <Feather name="trash-2" size={17} color={colors.errorText} />
                    </FeedbackPressable>
                  </View>
                );
              })}
            </View>
          )
        ) : displayedError && displayedSpots.length > 0 ? (
          <View className="mt-4 flex-row items-center rounded-2xl border border-errorBorder bg-errorSurface px-4 py-3">
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="flex-1 pr-3 font-outfit-medium text-sm text-errorText"
            >
              {displayedError} Showing what we already had.
            </Text>
            <FeedbackPressable
              onPress={handleRetryDisplayedSpots}
              className="rounded-xl bg-accent px-3 py-2"
              accessibilityRole="button"
              accessibilityLabel={`Retry loading ${showingLikedSpots ? 'liked' : 'created'} spots`}
            >
              <Text className="font-outfit-bold text-xs text-brand">Retry</Text>
            </FeedbackPressable>
          </View>
        ) : null}

        {!showingDrafts ? (
        displayedLoading && displayedSpots.length === 0 ? (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Loading ${showingLikedSpots ? 'liked' : 'your'} spots`}
            className="mt-6 items-center rounded-2xl bg-field px-4 py-6"
          >
            <ActivityIndicator size="small" color={colors.ink} />
            <Text className="mt-2 font-outfit-medium text-sm text-muted">
              Loading spots…
            </Text>
          </View>
        ) : displayedError ? (
          <View className="mt-4 items-center rounded-2xl border border-errorBorder bg-errorSurface p-5">
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="text-center font-outfit-medium text-sm text-errorText"
            >
              {displayedError}
            </Text>
            <FeedbackPressable
              onPress={handleRetryDisplayedSpots}
              className="mt-3 rounded-xl bg-accent px-4 py-2"
              accessibilityRole="button"
              accessibilityLabel={`Retry loading ${showingLikedSpots ? 'liked' : 'created'} spots`}
            >
              <Text className="font-outfit-bold text-xs text-brand">Retry</Text>
            </FeedbackPressable>
          </View>
        ) : displayedSpots.length === 0 ? (
          <View className="mt-4 rounded-2xl bg-field p-6">
            <Text className="font-outfit-medium text-center text-sm text-muted">
              {showingLikedSpots
                ? 'Spots you like will show up here.'
                : 'No spots yet. Hit + on a campus map to add one.'}
            </Text>
          </View>
        ) : (
          <View className="mt-3">
            {displayedSpots.map((spot) => (
              <View
                key={spot.id}
                className="mb-4 flex-row items-center rounded-2xl bg-field p-4"
              >
                <FeedbackPressable
                  onPress={() => handleSpotPress(spot)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${spot.name} on the ${spot.schoolName || 'campus'} map`}
                  accessibilityHint="Opens the campus map and selects this spot"
                >
                  {spot.imageUris.length > 0 ? (
                    <Image
                      source={{ uri: spot.imageUris[0] }}
                      className="h-16 w-16 rounded-xl"
                      resizeMode="cover"
                      accessible={false}
                    />
                  ) : (
                    <View
                      accessible={false}
                      importantForAccessibility="no-hide-descendants"
                      className="h-16 w-16 items-center justify-center rounded-xl bg-surface-soft"
                    >
                      <Feather name="image" size={20} color={colors.muted} />
                    </View>
                  )}
                </FeedbackPressable>

                <View className="ml-3 min-w-0 flex-1">
                  <ExpandableText
                    collapsedLines={1}
                    className="font-outfit-bold text-base text-ink"
                    onPress={() => handleSpotPress(spot)}
                    accessibilityLabel={`Open ${spot.name} on the ${spot.schoolName || 'campus'} map`}
                    accessibilityHint="Opens the campus map and selects this spot"
                  >
                    {spot.name}
                  </ExpandableText>
                  <View className="mt-0.5 flex-row items-center">
                    <Feather name="map-pin" size={11} color={colors.muted} />
                    <View className="ml-1 min-w-0 flex-1">
                        <ExpandableText
                          collapsedLines={1}
                          className="font-outfit-semibold text-xs text-muted-soft"
                          onPress={() => handleSpotPress(spot)}
                          accessibilityLabel={`Open ${spot.name} on the ${spot.schoolName || 'campus'} map`}
                          accessibilityHint="Opens the campus map and selects this spot"
                        >
                          {`${spot.schoolName || 'Campus map'}${spot.city || spot.state ? ` · ${spot.city}${spot.city && spot.state ? ', ' : ''}${spot.state}` : ''}`}
                        </ExpandableText>
                    </View>
                  </View>
                  {spot.description.trim().length > 0 ? (
                    <ExpandableText
                      collapsedLines={2}
                      className="font-outfit-medium mt-0.5 text-sm text-muted"
                      onPress={() => handleSpotPress(spot)}
                      accessibilityLabel={`Open ${spot.name} on the ${spot.schoolName || 'campus'} map`}
                      accessibilityHint="Opens the campus map and selects this spot"
                    >
                      {spot.description.trim()}
                    </ExpandableText>
                  ) : null}
                  <View className="mt-1 flex-row items-center">
                    <Octicons name="heart-fill" size={12} color={colors.accent} />
                    <Text className="font-outfit-semibold ml-1 text-xs text-muted">
                      {spot.likeCount ?? 0}
                    </Text>
                  </View>
                </View>

                {showingLikedSpots ? (
                  <FeedbackPressable
                    onPress={() => handleUnlike(spot)}
                    disabled={likingId === spot.id}
                    className="ml-2 h-12 w-12 items-center justify-center rounded-full bg-accent"
                    accessibilityLabel={`Unlike ${spot.name}`}
                    accessibilityRole="button"
                    accessibilityState={{ busy: likingId === spot.id }}
                  >
                    {likingId === spot.id ? (
                      <ActivityIndicator size="small" color={colors.brand} />
                    ) : (
                      <Octicons name="heart-fill" size={17} color={colors.brand} />
                    )}
                  </FeedbackPressable>
                ) : deletingId === spot.id ? (
                  <View
                    accessible
                    accessibilityRole="progressbar"
                    accessibilityLabel={`Deleting ${spot.name}`}
                    className="ml-2 h-12 w-12 items-center justify-center"
                  >
                    <ActivityIndicator size="small" color={colors.ink} />
                  </View>
                ) : (
                  <View className="ml-2 flex-row">
                    <FeedbackPressable
                      haptic="light"
                      onPress={() => handleEdit(spot)}
                      className="h-12 w-12 items-center justify-center rounded-full"
                      accessibilityLabel={`Edit ${spot.name}`}
                      accessibilityRole="button"
                    >
                      <Feather name="edit-2" size={17} color={colors.ink} />
                    </FeedbackPressable>
                    <FeedbackPressable
                      onPress={() => handleDelete(spot)}
                      className="h-12 w-12 items-center justify-center rounded-full"
                      accessibilityLabel={`Delete ${spot.name}`}
                      accessibilityRole="button"
                    >
                      <Feather name="trash-2" size={17} color={colors.errorText} />
                    </FeedbackPressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )
        ) : null}

        <View className="mt-8 items-center">
          <SocialLinks showCaption />
        </View>
      </ScrollView>
    </View>
  );
}
