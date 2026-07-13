import { Ionicons, Octicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Image,
    Keyboard,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
    type GestureResponderEvent,
} from 'react-native';
import IMAGES from '../constants/images';
import { useAuthStore } from '../store/authStore';
import { useFavorites } from '../store/favoritesStore';
import { useSchools } from '../store/schoolsStore';
import type { School } from '../types/school';

type SchoolRowProps = {
  school: School;
  displayNumSpots: number;
  isFavorite: boolean;
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
  onSelect,
  onFavoritePress,
  isDropdownItem = false,
}: SchoolRowProps) {
  if (!isDropdownItem) {
    return (
      <Pressable
        onPress={() => onSelect(school)}
        className="flex-row items-center justify-between p-2 mb-3 rounded-3xl border border-slate-200/60 bg-[#F0F5F4]"
      >
        <View className="min-w-0 flex-1 flex-row items-center pr-2">
          <Pressable
            onPress={(event) => onFavoritePress(event, school)}
            className="h-11 w-11 items-center justify-center rounded-2xl bg-white"
          >
            <Octicons
              name={isFavorite ? 'star-fill' : 'star'}
              size={20}
              color={isFavorite ? '#1B3B36' : '#94A3B8'}
            />
          </Pressable>

          <View className="ml-4 min-w-0 flex-1">
            <Text 
              className="text-lg text-[#1B3B36]"
              style={{ fontFamily: 'Outfit_700Bold' }}
              numberOfLines={1}
              ellipsizeMode="tail"
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
          <Ionicons name="location-outline" size={14} color="#1B3B36" style={{ marginRight: 2 }} />
          <Text 
            className="text-base text-[#1B3B36]"
            style={{ fontFamily: 'Outfit_700Bold' }}
          >
            {formatSpotCount(displayNumSpots)}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => onSelect(school)}
      className="flex-row items-center justify-between py-3 px-4 border-b border-slate-100 bg-white"
    >
      <View className="min-w-0 flex-1 flex-row items-center pr-2">
        <Pressable
          onPress={(event) => onFavoritePress(event, school)}
          className="h-11 w-11 items-center justify-center rounded-2xl bg-[#F0F5F4]"
        >
          <Octicons
            name={isFavorite ? 'star-fill' : 'star'}
            size={20}
            color={isFavorite ? '#1B3B36' : '#94A3B8'}
          />
        </Pressable>

        <View className="ml-3 min-w-0 flex-1">
          <Text 
            className="text-base text-[#1B3B36]"
            style={{ fontFamily: 'Outfit_700Bold' }}
            numberOfLines={1}
            ellipsizeMode="tail"
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
        <Ionicons name="location-outline" size={14} color="#1B3B36" style={{ marginRight: 2 }} />
        <Text 
          className="text-base text-[#1B3B36]"
          style={{ fontFamily: 'Outfit_700Bold' }}
        >
          {formatSpotCount(displayNumSpots)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { schools, upsertSchool } = useSchools();
  const session = useAuthStore((state) => state.session);
  const {
    favoriteSchoolIds,
    favoriteSchools: storedFavoriteSchools,
    toggleFavoriteSchool,
    upsertFavoriteSchool,
  } = useFavorites();

  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

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

  useEffect(() => {
    const missingFavoriteSchoolIds = favoriteSchoolIds.filter(
      (schoolId) => !schools.some((school) => school.id === schoolId)
    );

    if (missingFavoriteSchoolIds.length === 0) {
      return;
    }

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
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        console.warn('Unable to load favorite schools', error);
      }
    };

    fetchMissingFavoriteSchools();

    return () => {
      controller.abort();
    };
  }, [favoriteSchoolIds, schools, upsertFavoriteSchool, upsertSchool]);

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
  }, [searchQuery, selectedSchool?.name, upsertFavoriteSchool, upsertSchool]);

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

  const handleSchoolSelect = (school: School) => {
    upsertSchool(school);
    setSelectedSchool(school);
    setSearchQuery(school.name);
    setSearchResults([]);
    setSearchError('');
    setIsOpen(false);
  };

  const handleFavoritePress = (
    event: GestureResponderEvent,
    school: School
  ) => {
    event.stopPropagation();
    upsertSchool(school);
    toggleFavoriteSchool(school);
  };

  const handleGoPress = () => {
    if (!selectedSchool) {
      return;
    }

    router.push({
      pathname: '/map',
      params: {
        lat: selectedSchool.lat.toString(),
        lng: selectedSchool.lng.toString(),
        schoolName: selectedSchool.name,
        schoolId: selectedSchool.id,
        schoolCity: selectedSchool.city,
        schoolState: selectedSchool.state,
        schoolNumSpots: getDisplaySpotCount(selectedSchool).toString(),
      },
    });
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
        <View className="flex-row items-center space-x-3">
          <Image 
            source={IMAGES.logo} 
            className="h-12 w-12 rounded-2xl"
            resizeMode="contain"
          />
          <Text 
            className="text-4xl text-white tracking-tight ml-4"
            style={{ fontFamily: 'Outfit_900Black' }}
          >
            SkateU
          </Text>
        </View>

        <Pressable
          onPress={handleProfilePress}
          className="h-12 w-12 items-center justify-center rounded-full bg-white/15 border border-white/25"
          accessibilityLabel="Open profile"
          accessibilityRole="button"
        >
          <Ionicons
            name="person-outline"
            size={22}
            color="white"
            style={{
              textShadowColor: 'white',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 1.2,
            }}
          />
        </Pressable>
      </View>

      <View className="flex-1 px-5 pt-6 relative">
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
            Glad you're here!
          </Text>
          <Text 
            className="text-base text-slate-500/90"
            style={{ fontFamily: 'Outfit_500Medium' }}
          >
            Find a new campus skate spot.
          </Text>
        </View>

        {/* Input Bar Area */}
        <View className="relative mb-6">
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
            className="rounded-2xl bg-[#F0F3F5] py-5 pl-14 pr-12 text-lg text-[#1B3B36]"
            style={{ fontFamily: 'Outfit_600SemiBold' }}
          />

          <Pressable
            onPress={handleClearSearch}
            className="absolute right-4 top-2.5 h-8 w-8 items-center justify-center rounded-full bg-[#F0F3F5]"
          >
            <Text className="text-sm font-bold text-slate-400">✕</Text>
          </Pressable>
        </View>

        {/* BACKGROUND SECTION: Stays visible but blocks touch interactions when dropdown is open */}
        <View 
          className="flex-1" 
          pointerEvents={isOpen ? 'none' : 'auto'}
        >
          {/* Favorites Header & Content List */}
            <View className="flex-1">
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
                  {favoriteSchools.length}{' '}
                  {favoriteSchools.length === 1 ? 'school' : 'schools'}
                </Text>
              </View>

            <View className="h-70 overflow-hidden">
              {favoriteSchools.length === 0 ? (
                <View className="items-center justify-center rounded-3xl bg-[#F0F5F4] px-6 py-8">
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
                    school's map screen to save it here.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {favoriteSchools.map((school: School) => (
                    <SchoolRow
                      key={school.id}
                      school={school}
                      displayNumSpots={getDisplaySpotCount(school)}
                      isFavorite
                      onSelect={handleSchoolSelect}
                      onFavoritePress={handleFavoritePress}
                    />
                  ))}
                </ScrollView>
              )}
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

        {/* Dropdown Overlay Menu Results Container */}
        {isOpen && (
          <View className="absolute left-5 right-5 top-[225px] max-h-80 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl z-50">
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
                <Text
                  className="px-4 py-4 text-base text-slate-400 bg-white"
                  style={{ fontFamily: 'Outfit_500Medium' }}
                >
                  {searchError}
                </Text>
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
                  Keep typing to search by school's full name or city
                </Text>
              ) : sortedSearchResults.length > 0 ? (
                sortedSearchResults.map((school: School) => (
                  <SchoolRow
                    key={school.id}
                    school={school}
                    displayNumSpots={getDisplaySpotCount(school)}
                    isFavorite={favoriteSchoolIds.includes(school.id)}
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
      <View className="p-5 bg-white pb-6" pointerEvents={isOpen ? 'none' : 'auto'}>
        <Pressable
          onPress={handleGoPress}
          disabled={!selectedSchool}
          className={`w-full rounded-2xl py-4 flex-row items-center justify-center space-x-2 relative -top-4 ${
            selectedSchool ? 'bg-[#1B3B36]' : 'bg-slate-300'
          }`}
        >
          <Text 
            className="text-center text-lg text-white"
            style={{ fontFamily: 'Outfit_700Bold' }}
          >
            Go
          </Text>
          <Text 
            className="text-white text-sm"
            style={{ fontFamily: 'Outfit_700Bold' }}
          >   ❯</Text>
        </Pressable>
      </View>
    </View>
  );
}
