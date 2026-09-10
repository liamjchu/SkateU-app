import { Feather, Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../constants/colors';
import { useHydrateFavoriteSchools } from '../hooks/useHydrateFavoriteSchools';
import { getApiUrl } from '../lib/api';
import {
  getSchoolSearchCopy,
  MIN_SEARCH_LENGTH,
  schoolMatchesQuery,
} from '../lib/schoolSearch';
import { toUserFacingError } from '../lib/userFacingError';
import { useFavorites } from '../store/favoritesStore';
import { useSchools } from '../store/schoolsStore';
import type { School, SchoolTypeFilter } from '../types/school';
import FeedbackPressable from './FeedbackPressable';
import PopularSchoolCard from './PopularSchoolCard';
import SchoolTypePills, { getSchoolTypesParam } from './SchoolTypePills';

type SchoolsSearchResponse = {
  schools: School[];
};

type MapExploreChromeProps = {
  topInset: number;
  school: School | null;
  isFavorite: boolean;
  savedSchoolIds: string[];
  onSelectSchool: (school: School) => void;
  onToggleFavorite: () => void;
  onDismissSchool: () => void;
  onToggleSaveResult: (school: School) => void;
};

export default function MapExploreChrome({
  topInset,
  school,
  isFavorite,
  savedSchoolIds,
  onSelectSchool,
  onToggleFavorite,
  onDismissSchool,
  onToggleSaveResult,
}: MapExploreChromeProps) {
  const searchInputRef = useRef<TextInput>(null);
  const schools = useSchools((state) => state.schools);
  const upsertSchool = useSchools((state) => state.upsertSchool);
  const upsertFavoriteSchool = useFavorites((state) => state.upsertFavoriteSchool);
  const {
    favoriteSchools,
    isHydrating: isHydratingFavorites,
    error: favoriteHydrateError,
    retry: retryFavoriteSchools,
  } = useHydrateFavoriteSchools();

  const [activeFilter, setActiveFilter] = useState<SchoolTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchRetryNonce, setSearchRetryNonce] = useState(0);

  const trimmedQuery = searchQuery.trim();
  const isSearchOpen = isSearchActive;
  const schoolSearchCopy = getSchoolSearchCopy(activeFilter);
  const showRemoteSearchResults =
    activeFilter !== 'saved' && trimmedQuery.length >= MIN_SEARCH_LENGTH;

  const displayedSearchResults = searchResults.map((searchResult) => {
    return (
      schools.find((item) => item.id === searchResult.id) ??
      favoriteSchools.find((item) => item.id === searchResult.id) ??
      searchResult
    );
  });

  const savedSearchResults = favoriteSchools.filter((item) =>
    schoolMatchesQuery(item, searchQuery)
  );

  const sortedSearchResults = useMemo(() => {
    if (activeFilter === 'saved') {
      return savedSearchResults;
    }

    return [
      ...displayedSearchResults.filter((item) => savedSchoolIds.includes(item.id)),
      ...displayedSearchResults.filter((item) => !savedSchoolIds.includes(item.id)),
    ];
  }, [
    activeFilter,
    displayedSearchResults,
    savedSchoolIds,
    savedSearchResults,
  ]);

  const searchStatusText = isSearching
    ? 'Searching…'
    : `${sortedSearchResults.length} ${
        sortedSearchResults.length === 1 ? 'school' : 'schools'
      }`;

  const closeSearch = useCallback(() => {
    searchInputRef.current?.blur();
    Keyboard.dismiss();
    setIsSearchActive(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
    setActiveFilter('all');
  }, []);

  const handleSelectSchool = (nextSchool: School) => {
    closeSearch();
    onSelectSchool(nextSchool);
  };

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        closeSearch();
        return true;
      }
    );

    return () => subscription.remove();
  }, [closeSearch, isSearchOpen]);

  useEffect(() => {
    if (activeFilter === 'saved' || trimmedQuery.length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError('');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setSearchError('');

      try {
        const typeParam = getSchoolTypesParam(activeFilter);
        const typeQuery = typeParam
          ? `&type=${encodeURIComponent(typeParam)}`
          : '';
        const response = await fetch(
          getApiUrl(
            `/api/schools?search=${encodeURIComponent(trimmedQuery)}${typeQuery}`
          ),
          { signal: controller.signal }
        );

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            errorData?.error ??
              `School search failed with status ${response.status}`
          );
        }

        const data = (await response.json()) as SchoolsSearchResponse;
        const page = data.schools ?? [];
        page.forEach((item) => {
          upsertSchool(item);
          upsertFavoriteSchool(item);
        });
        setSearchResults(page);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        setSearchError(
          toUserFacingError(error, 'Couldn’t search schools right now.')
        );
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [
    activeFilter,
    searchRetryNonce,
    trimmedQuery,
    upsertFavoriteSchool,
    upsertSchool,
  ]);

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-0"
      style={{ zIndex: isSearchOpen ? 1100 : 60 }}
    >
      {isSearchOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close school search"
          onPress={closeSearch}
          className="absolute inset-0"
        />
      ) : null}

      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0 px-4"
        style={{ top: topInset + 8 }}
      >
      <View className="flex-row items-center">
        <View className="min-w-0 flex-1 overflow-hidden rounded-full bg-field">
          <View className="relative justify-center">
            <View className="absolute left-4 z-10">
              <Ionicons name="search" size={18} color={colors.ink} />
            </View>
            <TextInput
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchActive(true)}
              placeholder={schoolSearchCopy.placeholder}
              placeholderTextColor={colors.muted}
              accessibilityLabel={schoolSearchCopy.accessibilityLabel}
              accessibilityHint={schoolSearchCopy.accessibilityHint}
              numberOfLines={1}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              className="h-12 pl-11 pr-11 font-outfit-medium text-base text-ink"
            />
            {trimmedQuery.length > 0 ? (
              <FeedbackPressable
                haptic="light"
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setSearchError('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-1.5 z-10 h-9 w-9 items-center justify-center rounded-full"
                accessibilityLabel="Clear school search"
                accessibilityRole="button"
              >
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </FeedbackPressable>
            ) : null}
          </View>
        </View>
        {isSearchOpen ? (
          <FeedbackPressable
            haptic="light"
            onPress={closeSearch}
            className="ml-2 h-12 items-center justify-center rounded-full bg-field px-3.5"
            accessibilityRole="button"
            accessibilityLabel="Cancel school search"
          >
            <Text className="font-outfit-semibold text-sm text-ink">
              Cancel
            </Text>
          </FeedbackPressable>
        ) : null}
      </View>

      {isSearchOpen ? (
        <View className="mt-2">
          <SchoolTypePills
            selected={activeFilter}
            onSelect={setActiveFilter}
            variant="compact"
          />
        </View>
      ) : null}

      {school && !isSearchOpen ? (
        <View className="mt-2 flex-row items-center rounded-full bg-field px-2 py-1.5">
          <View className="min-w-0 flex-1 px-2">
            <Text
              numberOfLines={1}
              className="font-outfit-bold text-sm text-ink"
            >
              {school.name}
            </Text>
            {school.city && school.state ? (
              <Text
                numberOfLines={1}
                className="font-outfit-medium text-xs text-muted"
              >
                {school.city}, {school.state}
              </Text>
            ) : null}
          </View>
          <FeedbackPressable
            haptic="selection"
            onPress={onToggleFavorite}
            className="h-10 w-10 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel={
              isFavorite
                ? 'Remove school from saved schools'
                : 'Save this school'
            }
            accessibilityState={{ selected: isFavorite }}
          >
            <Ionicons
              name={isFavorite ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isFavorite ? colors.accent : colors.ink}
            />
          </FeedbackPressable>
          <FeedbackPressable
            haptic="light"
            onPress={onDismissSchool}
            className="h-10 w-10 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Leave this campus"
          >
            <Feather name="x" size={18} color={colors.ink} />
          </FeedbackPressable>
        </View>
      ) : null}

      {isSearchOpen ? (
        <View className="mt-2 max-h-[50vh] overflow-hidden rounded-2xl bg-field">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            className="max-h-[50vh] px-3 pt-3"
          >
            {activeFilter === 'saved' ? (
              <>
                {favoriteHydrateError ? (
                  <View className="mb-3 flex-row items-center rounded-2xl border border-errorBorder bg-errorSurface px-3 py-2.5">
                    <Text className="flex-1 pr-2 font-outfit-medium text-sm text-errorText">
                      {favoriteHydrateError}
                    </Text>
                    <FeedbackPressable
                      onPress={retryFavoriteSchools}
                      className="rounded-xl bg-accent px-3 py-1.5"
                      accessibilityRole="button"
                      accessibilityLabel="Retry refreshing saved schools"
                    >
                      <Text className="font-outfit-bold text-sm text-brand">
                        Retry
                      </Text>
                    </FeedbackPressable>
                  </View>
                ) : null}
                {isHydratingFavorites && favoriteSchools.length === 0 ? (
                  <View
                    className="items-center py-6"
                    accessibilityLabel="Loading saved schools"
                  >
                    <ActivityIndicator color={colors.accent} />
                    <Text className="mt-2 font-outfit-medium text-sm text-muted">
                      Restoring your saved schools.
                    </Text>
                  </View>
                ) : favoriteSchools.length === 0 ? (
                  <Text className="pb-3 font-outfit-medium text-sm text-muted">
                    Tap the bookmark on a school to keep it here.
                  </Text>
                ) : savedSearchResults.length === 0 ? (
                  <Text className="pb-3 font-outfit-medium text-sm text-muted">
                    Nothing in Saved matches that search.
                  </Text>
                ) : (
                  savedSearchResults.map((result) => (
                    <PopularSchoolCard
                      key={result.id}
                      school={result}
                      isSaved={savedSchoolIds.includes(result.id)}
                      onPress={handleSelectSchool}
                      onToggleSave={onToggleSaveResult}
                    />
                  ))
                )}
              </>
            ) : showRemoteSearchResults ? (
              <>
                <Text
                  accessibilityLiveRegion="polite"
                  className="mb-3 font-outfit-bold text-sm text-ink"
                >
                  {searchStatusText}
                </Text>
                {searchError ? (
                  <View className="mb-3 flex-row items-center rounded-2xl border border-errorBorder bg-errorSurface px-3 py-2.5">
                    <Text className="flex-1 pr-2 font-outfit-medium text-sm text-errorText">
                      {searchError}
                    </Text>
                    <FeedbackPressable
                      onPress={() => {
                        setSearchError('');
                        setSearchRetryNonce((nonce) => nonce + 1);
                      }}
                      className="rounded-xl bg-accent px-3 py-1.5"
                      accessibilityRole="button"
                      accessibilityLabel="Retry school search"
                    >
                      <Text className="font-outfit-bold text-sm text-brand">
                        Retry
                      </Text>
                    </FeedbackPressable>
                  </View>
                ) : null}
                {isSearching && sortedSearchResults.length === 0 ? (
                  <View
                    className="items-center py-6"
                    accessibilityLabel="Searching schools"
                  >
                    <ActivityIndicator color={colors.accent} />
                  </View>
                ) : sortedSearchResults.length > 0 ? (
                  sortedSearchResults.map((result) => (
                    <PopularSchoolCard
                      key={result.id}
                      school={result}
                      isSaved={savedSchoolIds.includes(result.id)}
                      onPress={handleSelectSchool}
                      onToggleSave={onToggleSaveResult}
                    />
                  ))
                ) : searchError ? null : (
                  <Text className="pb-3 font-outfit-medium text-sm text-muted">
                    No schools found.
                  </Text>
                )}
              </>
            ) : trimmedQuery.length > 0 ? (
              <Text className="pb-3 font-outfit-medium text-sm text-muted">
                Keep typing a school, city, or 2-letter state.
              </Text>
            ) : (
              <Text className="pb-3 font-outfit-medium text-sm text-muted">
                Type a school, city, or 2-letter state.
              </Text>
            )}
          </ScrollView>
        </View>
      ) : null}
      </View>
    </View>
  );
}
