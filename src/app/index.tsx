import { Feather, Ionicons, Octicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    BackHandler,
    Image,
    Keyboard,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
    useWindowDimensions,
    type GestureResponderEvent
} from 'react-native';
import FavoriteSchoolRow from '../components/FavoriteSchoolRow';
import FeedbackPressable from '../components/FeedbackPressable';
import IMAGES from '../constants/images';
import { triggerHaptic } from '../lib/haptics';
import { useAuthStore } from '../store/authStore';
import { useFavorites } from '../store/favoritesStore';
import { useProfileStore } from '../store/profileStore';
import { useSchools } from '../store/schoolsStore';
import type { School } from '../types/school';

type SchoolRowProps = {
  school: School;
  displayNumSpots: number;
  isFavorite: boolean;
  isSelected: boolean;
  onSelect: (school: School) => void;
  onFavoritePress: (
    event: GestureResponderEvent,
    school: School
  ) => void;
  isDropdownItem?: boolean;
};

type SchoolsSearchResponse = {
  schools: School[];
};

function isAbsoluteUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function isCollegeOrUniversity(school: School) {
  return school.type === 'higher_ed';
}

function getApiUrl(path: string) {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL;

  if (configuredUrl) {
    if (Platform.OS !== 'web' && !isAbsoluteUrl(configuredUrl)) {
      throw new Error(
        'EXPO_PUBLIC_API_URL must be an absolute URL on native platforms.'
      );
    }

    return `${configuredUrl.replace(/\/$/, '')}${path}`;
  }

  if (Platform.OS === 'web') {
    return path;
  }

  const hostUri = Constants.expoConfig?.hostUri;

  if (hostUri) {
    return `http://${hostUri}${path}`;
  }

  throw new Error(
    'Missing API URL for native platforms. Set EXPO_PUBLIC_API_URL to an absolute URL or run through Expo with a host URI.'
  );
}

function formatSpotCount(count: number) {
  if (count < 1000) {
    return count.toString();
  }

  if (count < 1000000) {
    return `${Math.floor(count / 100) / 10}K`;
  }

  return `${Math.floor(count / 100000) / 10}M`;
}

function SchoolRow({
  school,
  displayNumSpots,
  isFavorite,
  isSelected,
  onSelect,
  onFavoritePress,
  isDropdownItem = false,
}: SchoolRowProps) {
  if (!isDropdownItem) {
    return (
      <FeedbackPressable
        haptic="selection"
        onPress={() => onSelect(school)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${school.name}`}
        accessibilityHint="Opens the campus map"
        accessibilityState={{ selected: isSelected }}
        className={`flex-row items-center justify-between p-2 mb-3 rounded-3xl border bg-[#F0F5F4] ${
          isSelected ? 'border-[#1B3B36] bg-[#E3ECEA]' : 'border-slate-200/60'
        }`}
      >
        <View className="min-w-0 flex-1 flex-row items-center pr-2">
          <FeedbackPressable
            haptic="selection"
            onPress={(event) => onFavoritePress(event, school)}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-white"
            accessibilityRole="button"
            accessibilityLabel={`${isFavorite ? 'Remove' : 'Add'} ${school.name} ${isFavorite ? 'from' : 'to'} favorites`}
            accessibilityState={{ selected: isFavorite }}
          >
            <Octicons
              name={isFavorite ? 'star-fill' : 'star'}
              size={20}
              color={isFavorite ? '#1B3B36' : '#94A3B8'}
            />
          </FeedbackPressable>

          <View className="ml-4 min-w-0 flex-1">
            <Text
              className="text-lg text-[#1B3B36]"
              style={{ fontFamily: 'Outfit_700Bold' }}
            >
              {school.name}
            </Text>
            <Text
              className="text-sm text-slate-400 mt-0.5"
              style={{ fontFamily: 'Outfit_500Medium' }}
            >
              {school.city}, {school.state}
            </Text>
          </View>
        </View>

        <View className="w-20 shrink-0 flex-row items-center justify-center space-x-1.5 rounded-xl bg-white/50 px-3 py-1.5">
          <Feather
            name="map-pin"
            size={11}
            color="#64748b"
            className="mr-[3px]"
          />
          <Text
            className="text-base text-[#1B3B36]"
            style={{ fontFamily: 'Outfit_700Bold' }}
          >
            {formatSpotCount(displayNumSpots)}
          </Text>
        </View>
      </FeedbackPressable>
    );
  }

  return (
    <FeedbackPressable
      haptic="selection"
      onPress={() => onSelect(school)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${school.name}`}
      accessibilityHint="Opens the campus map"
      accessibilityState={{ selected: isSelected }}
      className={`flex-row items-center justify-between py-3 px-4 border-b bg-white ${
        isSelected ? 'border-[#1B3B36] bg-[#E3ECEA]' : 'border-slate-100'
      }`}
    >
      <View className="min-w-0 flex-1 flex-row items-center pr-2">
        <FeedbackPressable
          haptic="selection"
          onPress={(event) => onFavoritePress(event, school)}
          className="h-12 w-12 items-center justify-center rounded-2xl bg-[#F0F5F4]"
          accessibilityRole="button"
          accessibilityLabel={`${isFavorite ? 'Remove' : 'Add'} ${school.name} ${isFavorite ? 'from' : 'to'} favorites`}
          accessibilityState={{ selected: isFavorite }}
        >
          <Octicons
            name={isFavorite ? 'star-fill' : 'star'}
            size={20}
            color={isFavorite ? '#1B3B36' : '#94A3B8'}
          />
        </FeedbackPressable>

        <View className="ml-3 min-w-0 flex-1">
          <Text
            className="text-base text-[#1B3B36]"
            style={{ fontFamily: 'Outfit_700Bold' }}
          >
            {school.name}
          </Text>
          <Text
            className="text-sm text-slate-400 mt-0.5"
            style={{ fontFamily: 'Outfit_500Medium' }}
          >
            {school.city}, {school.state}
          </Text>
        </View>
      </View>

      <View className="w-20 shrink-0 flex-row items-center justify-end space-x-1.5">
        <Feather
          name="map-pin"
          size={11}
          color="#64748b"
          className="mr-[3px]"
        />
        <Text
          className="text-base text-[#1B3B36]"
          style={{ fontFamily: 'Outfit_700Bold' }}
        >
          {formatSpotCount(displayNumSpots)}
        </Text>
      </View>
    </FeedbackPressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { schools, upsertSchool } = useSchools();
  const session = useAuthStore((state) => state.session);
  const profile = useProfileStore((state) => state.profile);
  const welcomeAboardUserId = useProfileStore(
    (state) => state.welcomeAboardUserId
  );
  const {
    favoriteSchoolIds,
    favoriteSchools: storedFavoriteSchools,
    hasHydrated: hasHydratedFavorites,
    toggleFavoriteSchool,
    upsertFavoriteSchool,
  } = useFavorites();

  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchRetryNonce, setSearchRetryNonce] = useState(0);
  const [favoriteRefreshError, setFavoriteRefreshError] = useState('');
  const [favoriteRefreshNonce, setFavoriteRefreshNonce] = useState(0);
  const [isHydratingFavoriteSchools, setIsHydratingFavoriteSchools] =
    useState(true);
  const [searchBarBottom, setSearchBarBottom] = useState(0);
  const [removingFavoriteSchoolId, setRemovingFavoriteSchoolId] = useState<
    string | null
  >(null);
  const { height, width } = useWindowDimensions();
  const isTabletLayout = width >= 768 && height >= 600;

  const getDisplaySpotCount = (school: School) => {
    return school.numSpots;
  };

  const favoriteSchools = favoriteSchoolIds
    .map((schoolId) => {
      const school =
        schools.find((school: School) => school.id === schoolId) ??
        storedFavoriteSchools.find((school) => school.id === schoolId);

      return school;
    })
    .filter((school): school is School => !!school);

  const displayedSearchResults = searchResults.map((searchResult) => {
    const school =
      schools.find((school: School) => school.id === searchResult.id) ??
      searchResult;

    return school;
  });

  const sortedSearchResults = [
    ...displayedSearchResults.filter((school: School) =>
      favoriteSchoolIds.includes(school.id)
    ),
    ...displayedSearchResults.filter(
      (school: School) => !favoriteSchoolIds.includes(school.id)
    ),
  ];

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? 'Good morning 👋'
      : hour < 18
        ? 'Good afternoon 👋'
      : 'Good evening 👋';
  const welcomeMessage = !session?.user || !profile?.username
    ? "Glad you're here!"
    : welcomeAboardUserId === session.user.id
      ? `Welcome aboard, ${profile.username}!`
      : `Welcome back, ${profile.username}!`;
  const profileInitial =
    profile?.username?.charAt(0).toUpperCase() ||
    session?.user.email?.charAt(0).toUpperCase() ||
    'P';

  useEffect(() => {
    if (!hasHydratedFavorites) {
      setIsHydratingFavoriteSchools(true);
      return;
    }

    const missingFavoriteSchoolIds = favoriteSchoolIds.filter(
      (schoolId) => !schools.some((school) => school.id === schoolId)
    );

    if (missingFavoriteSchoolIds.length === 0) {
      setIsHydratingFavoriteSchools(false);
      return;
    }

    setIsHydratingFavoriteSchools(true);
    const controller = new AbortController();

    const fetchMissingFavoriteSchools = async () => {
      try {
        const response = await fetch(
          getApiUrl(`/api/schools?ids=${encodeURIComponent(missingFavoriteSchoolIds.join(','))}`),
          { signal: controller.signal }
        );

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            errorData?.error ?? `Favorite schools lookup failed with status ${response.status}`
          );
        }

        const data = (await response.json()) as SchoolsSearchResponse;
        data.schools.forEach((school) => {
          upsertSchool(school);
          upsertFavoriteSchool(school);
        });
        setFavoriteRefreshError('');
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        setFavoriteRefreshError(
          error instanceof Error ? error.message : 'Unable to load favorite schools right now.'
        );
      } finally {
        setIsHydratingFavoriteSchools(false);
      }
    };

    fetchMissingFavoriteSchools();

    return () => {
      controller.abort();
    };
  }, [
    favoriteRefreshNonce,
    favoriteSchoolIds,
    hasHydratedFavorites,
    schools,
    upsertFavoriteSchool,
    upsertSchool,
  ]);

  // Re-pull favorite schools' spot counts from the backend whenever the home
  // screen regains focus (e.g. after adding a spot on the map), so the counter
  // reflects the current schools.numspots column.
  useFocusEffect(
    useCallback(() => {
      if (!hasHydratedFavorites || favoriteSchoolIds.length === 0) {
        return;
      }

      const controller = new AbortController();
      if (favoriteRefreshNonce > 0) {
        setFavoriteRefreshError('');
      }

      const refreshFavoriteSchools = async () => {
        try {
          const response = await fetch(
            getApiUrl(`/api/schools?ids=${encodeURIComponent(favoriteSchoolIds.join(','))}`),
            { signal: controller.signal }
          );

          if (!response.ok) {
            throw new Error('Unable to refresh favorite schools right now.');
          }

          const data = (await response.json()) as SchoolsSearchResponse;
          data.schools.forEach((school) => {
            upsertSchool(school);
            upsertFavoriteSchool(school);
          });
          setFavoriteRefreshError('');
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }

          setFavoriteRefreshError(
            error instanceof Error ? error.message : 'Unable to refresh favorite schools right now.'
          );
        }
      };

      refreshFavoriteSchools();

      return () => {
        controller.abort();
      };
    }, [
      favoriteRefreshNonce,
      favoriteSchoolIds,
      hasHydratedFavorites,
      upsertFavoriteSchool,
      upsertSchool,
    ])
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setIsOpen(false);
        Keyboard.dismiss();
        return true;
      }
    );

    return () => subscription.remove();
  }, [isOpen]);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 3 || selectedSchool?.name === searchQuery) {
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
        const response = await fetch(
          getApiUrl(`/api/schools?search=${encodeURIComponent(trimmedQuery)}`),
          { signal: controller.signal }
        );

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            errorData?.error ?? `School search failed with status ${response.status}`
          );
        }

        const data = (await response.json()) as SchoolsSearchResponse;
        const collegeResults = data.schools.filter(isCollegeOrUniversity);

        collegeResults.forEach((school) => {
          upsertSchool(school);
          upsertFavoriteSchool(school);
        });
        setSearchResults(collegeResults);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        setSearchResults([]);
        setSearchError(error instanceof Error ? error.message : 'Unable to search schools right now.');
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [searchQuery, searchRetryNonce, selectedSchool?.name, upsertFavoriteSchool, upsertSchool]);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setIsOpen(true);

    if (selectedSchool && text !== selectedSchool.name) {
      setSelectedSchool(null);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedSchool(null);
    setSearchResults([]);
    setSearchError('');
    setIsOpen(false);
    Keyboard.dismiss();
  };

  const handleRetrySearch = () => {
    setSearchError('');
    setSearchRetryNonce((nonce) => nonce + 1);
  };

  const handleSchoolSelect = (school: School) => {
    upsertSchool(school);
    setSelectedSchool(school);
    setSearchQuery(school.name);
    setSearchResults([]);
    setSearchError('');
    setIsOpen(false);
  };

  const navigateToSchoolMap = (school: School) => {
    router.push({
      pathname: '/map',
      params: {
        lat: school.lat.toString(),
        lng: school.lng.toString(),
        schoolName: school.name,
        schoolId: school.id,
        schoolCity: school.city,
        schoolState: school.state,
        schoolNumSpots: getDisplaySpotCount(school).toString(),
      },
    });
  };

  const handleFavoriteSelect = (school: School) => {
    upsertSchool(school);
    navigateToSchoolMap(school);
  };

  const handleFavoritePress = (
    event: GestureResponderEvent,
    school: School
  ) => {
    event.stopPropagation();
    upsertSchool(school);
    toggleFavoriteSchool(school);
  };

  const handleRemoveFavoriteSchool = (school: School) => {
    if (removingFavoriteSchoolId) {
      return;
    }

    setRemovingFavoriteSchoolId(school.id);
    triggerHaptic('warning');
    toggleFavoriteSchool(school);
    setRemovingFavoriteSchoolId(null);
  };

  const handleGoPress = () => {
    if (!selectedSchool) {
      return;
    }

    navigateToSchoolMap(selectedSchool);
  };

  const handleProfilePress = () => {
    if (session) {
      router.push('/profile');
      return;
    }

    router.push('/login');
  };

  return (
    <View className="flex-1 bg-white">
      {/* Top Header Banner Section */}
      <View
        className="bg-[#21473f] pt-25 pb-8 px-6 flex-row items-center justify-between"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 12,
        }}
      >
        <View className="-ml-[7px] flex-row items-center space-x-3">
          <Image 
            source={IMAGES.logo} 
            className="h-14 w-14"
            resizeMode="contain"
          />
          <Text 
            className="-ml-[5px] text-4xl text-white tracking-tight"
            style={{ fontFamily: 'Outfit_900Black' }}
          >
            SkateU
          </Text>
        </View>

        <FeedbackPressable
          haptic="light"
          onPress={handleProfilePress}
          className="h-12 w-12 items-center justify-center rounded-full bg-white/15 border border-white/25"
          accessibilityLabel="Open profile"
          accessibilityRole="button"
        >
          {session ? (
            <Text
              className="font-outfit-black text-xl text-white"
              accessibilityLabel={`Profile initial ${profileInitial}`}
            >
              {profileInitial}
            </Text>
          ) : (
            <Octicons
              name="person"
              size={22}
              color="white"
              style={{
                textShadowColor: 'white',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 1.2,
              }}
            />
          )}
        </FeedbackPressable>
      </View>

      <View className="flex-1 self-center w-full max-w-[760px] px-5 pt-6 relative">
        {/* Welcome Message Card */}
        <View className="bg-[#EBF2F0] rounded-3xl p-6 mb-5">
          <Text 
            className="text-base text-slate-500 mb-1"
            style={{ fontFamily: 'Outfit_500Medium' }}
          >
            {greeting}
          </Text>
          <Text 
            className="text-3xl text-[#1B3B36] mb-1.5"
            style={{ fontFamily: 'Outfit_900Black' }}
          >
            {welcomeMessage}
          </Text>
          <Text 
            className="text-base text-slate-500/90"
            style={{ fontFamily: 'Outfit_500Medium' }}
          >
            Find a new campus skate spot.
          </Text>
        </View>

        {/* Input Bar Area */}
        <View
          className="relative z-50 mb-6"
          onLayout={({ nativeEvent }) => {
            setSearchBarBottom(
              nativeEvent.layout.y + nativeEvent.layout.height
            );
          }}
        >
          <View className="absolute left-4 top-3 z-10">
            <Ionicons name="search-outline" size={22} color="#1B3B36" />
          </View>
          <TextInput
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={() => setIsOpen(true)}
            onPressIn={() => setIsOpen(true)}
            placeholder="Search US colleges and universities..."
            placeholderTextColor="#8E9AA6"
            accessibilityLabel="Search colleges and universities"
            accessibilityHint="Type at least three characters to find a school"
            accessibilityState={{ expanded: isOpen }}
            className="rounded-2xl bg-[#F0F3F5] py-5 pl-14 pr-12 text-lg text-[#1B3B36]"
            style={{ fontFamily: 'Outfit_600SemiBold' }}
          />

          {searchQuery.length > 0 ? (
            <FeedbackPressable
              onPress={handleClearSearch}
              className="absolute right-4 top-2 h-12 w-12 items-center justify-center rounded-full bg-[#F0F3F5]"
              accessibilityRole="button"
              accessibilityLabel="Clear school search"
            >
              <Text className="text-sm font-bold text-slate-400">✕</Text>
            </FeedbackPressable>
          ) : null}

        </View>

        {/* BACKGROUND SECTION: Stays visible but blocks touch interactions when dropdown is open */}
        <View 
          className="flex-1" 
          pointerEvents={isOpen ? 'none' : 'auto'}
        >
          {/* Favorites Card */}
          <View className="flex-1 min-h-0">
            <View className="flex-1 min-h-0 rounded-3xl bg-[#EBF2F0] p-3">
              <View className="mb-3 flex-row items-center justify-between px-1">
                <Text
                  className="text-lg text-[#1B3B36]"
                  style={{ fontFamily: 'Outfit_900Black' }}
                >
                  Favorites
                </Text>
                <Text
                  className="text-sm text-slate-400"
                  style={{ fontFamily: 'Outfit_700Bold' }}
                >
                  {isHydratingFavoriteSchools
                    ? '...'
                    : `${favoriteSchools.length} ${favoriteSchools.length === 1 ? 'school' : 'schools'}`}
                </Text>
              </View>

              {favoriteRefreshError ? (
                <View className="mb-3 flex-row items-center rounded-2xl border border-[#F3B7B2] bg-[#FBE9E7] px-3 py-2">
                  <Text className="flex-1 pr-2 font-outfit-medium text-xs text-[#B45F58]">
                    Something went wrong refreshing favorites.
                  </Text>
                  <FeedbackPressable
                    onPress={() => {
                      setFavoriteRefreshError('');
                      setFavoriteRefreshNonce((nonce) => nonce + 1);
                    }}
                    className="rounded-lg bg-[#21473f] px-3 py-1.5"
                    accessibilityRole="button"
                    accessibilityLabel="Retry refreshing favorite schools"
                  >
                    <Text className="font-outfit-bold text-xs text-white">Retry</Text>
                  </FeedbackPressable>
                </View>
              ) : null}

              <View className="flex-1 min-h-0">
                {isHydratingFavoriteSchools ? (
                  <View
                    className="flex-1 items-center justify-center rounded-2xl bg-white/50 px-6 py-8"
                    accessibilityLabel="Loading favorite schools"
                    accessibilityLiveRegion="polite"
                  >
                    <Text
                      className="text-xl text-[#1B3B36]"
                      style={{ fontFamily: 'Outfit_700Bold' }}
                    >
                      Loading favorites...
                    </Text>
                    <Text
                      className="mt-1.5 text-center text-sm leading-5 text-slate-400"
                      style={{ fontFamily: 'Outfit_500Medium' }}
                    >
                      Restoring your saved schools.
                    </Text>
                  </View>
                ) : favoriteSchools.length === 0 ? (
                  <View className="flex-1 items-center justify-center rounded-2xl bg-white/50 px-6 py-8">
                    <View className="h-16 w-16 items-center justify-center rounded-2xl bg-[#E3ECEA]">
                      <Octicons name="star" size={30} color="#1B3B36" />
                    </View>
                    <Text
                      className="mt-4 text-xl text-[#1B3B36]"
                      style={{ fontFamily: 'Outfit_700Bold' }}
                    >
                      No favorites yet
                    </Text>
                    <Text
                      className="mt-1.5 text-center text-sm leading-5 text-slate-400"
                      style={{ fontFamily: 'Outfit_500Medium' }}
                    >
                      Tap the{' '}
                      <Octicons name="star-fill" size={13} color="#1B3B36" />
                      {' '}star on a school in the search dropdown or on the
                      school&apos;s map screen to save it here.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    className="flex-1"
                    contentContainerClassName="pb-1"
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                  >
                    {favoriteSchools.map((school: School) => (
                      <FavoriteSchoolRow
                        key={school.id}
                        school={school}
                        isRemoving={removingFavoriteSchoolId === school.id}
                        onRemove={handleRemoveFavoriteSchool}
                        onSelect={handleFavoriteSelect}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
          </View>

          {/* LANDSCAPE IMAGE BANNER */}
          <View className="w-full h-35 mt-4 mb-4 -mx-5">            
            <Image 
              source={IMAGES.landscape} 
              style={{ width: '110%', height: '100%' }} 
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Tap outside the dropdown to close search mode. The dropdown itself is rendered above this backdrop. */}
        {isOpen ? (
          <Pressable
            onPress={() => {
              setIsOpen(false);
              Keyboard.dismiss();
            }}
            className="absolute inset-0 z-40"
            accessibilityLabel="Close school search"
            accessibilityRole="button"
          />
        ) : null}

        {/* Dropdown Overlay Menu Results Container */}
        {isOpen && (
          <View
            className="absolute left-5 right-5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl z-50"
            style={{
              maxHeight: isTabletLayout ? 440 : 320,
              top: searchBarBottom + 8,
            }}
          >
            <View className="px-4 py-2 bg-slate-50 border-b border-slate-100">
              <Text 
                className="text-xs text-slate-400"
                style={{ fontFamily: 'Outfit_700Bold' }}
              >
                {searchQuery.trim().length < 3
                  ? 'Type 3 or more characters'
                  : sortedSearchResults.length === 20
                    ? '20+ schools, only first 20 listed'
                    : `${sortedSearchResults.length} schools found`}
              </Text>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {searchError ? (
                <View className="flex-row items-center bg-white px-4 py-3">
                  <Text
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    className="flex-1 pr-3 text-base text-[#B45F58]"
                    style={{ fontFamily: 'Outfit_500Medium' }}
                  >
                    Something went wrong. {searchError}
                  </Text>
                  <FeedbackPressable
                    onPress={handleRetrySearch}
                    className="rounded-xl bg-[#21473f] px-3 py-2"
                    accessibilityRole="button"
                    accessibilityLabel="Retry school search"
                  >
                    <Text className="font-outfit-bold text-xs text-white">Retry</Text>
                  </FeedbackPressable>
                </View>
              ) : isSearching ? (
                <Text
                  className="px-4 py-4 text-base text-slate-400 bg-white"
                  style={{ fontFamily: 'Outfit_500Medium' }}
                >
                  Searching schools...
                </Text>
              ) : searchQuery.trim().length < 3 ? (
                <Text
                  className="px-4 py-4 text-base text-slate-400 bg-white"
                  style={{ fontFamily: 'Outfit_500Medium' }}
                >
                  Keep typing to search by school&apos;s full name or city
                </Text>
              ) : sortedSearchResults.length > 0 ? (
                sortedSearchResults.map((school: School) => (
                  <SchoolRow
                    key={school.id}
                    school={school}
                    displayNumSpots={getDisplaySpotCount(school)}
                    isFavorite={favoriteSchoolIds.includes(school.id)}
                    isSelected={selectedSchool?.id === school.id}
                    onSelect={handleSchoolSelect}
                    onFavoritePress={handleFavoritePress}
                    isDropdownItem
                  />
                ))
              ) : (
                <Text 
                  className="px-4 py-4 text-base text-slate-400 bg-white"
                  style={{ fontFamily: 'Outfit_500Medium' }}
                >
                  No schools found
                </Text>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Sticky Bottom Action Trigger */}
      <View className="self-center w-full max-w-[760px] p-5 pb-6" pointerEvents={isOpen ? 'none' : 'auto'}>
        <FeedbackPressable
          haptic="light"
          onPress={handleGoPress}
          disabled={!selectedSchool}
          accessibilityRole="button"
          accessibilityLabel={selectedSchool ? `Open ${selectedSchool.name} map` : 'Choose a school to continue'}
          accessibilityState={{ disabled: !selectedSchool }}
          className={`w-full rounded-2xl py-4 flex-row items-center justify-center space-x-2 relative -top-4 ${
            selectedSchool ? 'bg-[#1B3B36]' : 'bg-slate-300'
          }`}
        >
          <Text 
            className="text-center text-lg text-white"
            style={{ fontFamily: 'Outfit_700Bold' }}
          >
            View campus map
          </Text>
          <Text 
            className="text-white text-sm"
            style={{ fontFamily: 'Outfit_700Bold' }}
          >   ❯</Text>
        </FeedbackPressable>
      </View>
    </View>
  );
}
