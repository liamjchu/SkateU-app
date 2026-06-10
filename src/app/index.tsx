import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import IMAGES from '../constants/images';
import { useFavorites } from '../store/favoritesStore';
import { useSchools } from '../store/schoolsStore';
import type { School } from '../types/school';

type SchoolRowProps = {
  school: School;
  isFavorite: boolean;
  onSelect: (school: School) => void;
  onFavoritePress: (
    event: GestureResponderEvent,
    schoolId: string
  ) => void;
  isDropdownItem?: boolean;
};

function SchoolRow({
  school,
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
        <View className="flex-row items-center flex-1 pr-2">
          <Pressable
            onPress={(event) => onFavoritePress(event, school.id)}
            className="h-11 w-11 items-center justify-center rounded-2xl bg-white"
          >
            <Text className={`-mt-1 text-xl ${isFavorite ? 'text-[#1B3B36]' : 'text-slate-400'}`}>
              {isFavorite ? '★' : '☆'}
            </Text>
          </Pressable>

          <View className="ml-4 flex-1">
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

        <View className="flex-row items-center space-x-1.5 bg-white/50 px-3 py-1.5 rounded-xl">
          <Text className="text-sm">📍</Text>
          <Text 
            className="text-base text-[#1B3B36]"
            style={{ fontFamily: 'Outfit_700Bold' }}
          >
            {school.numSpots ?? 0}
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
      <View className="flex-row items-center flex-1 pr-2">
        <Pressable
          onPress={(event) => onFavoritePress(event, school.id)}
          className="h-11 w-11 items-center justify-center rounded-2xl bg-[#F0F5F4]"
        >
          <Text className={`-mt-1 text-xl ${isFavorite ? 'text-[#1B3B36]' : 'text-slate-400'}`}>
            {isFavorite ? '★' : '☆'}
          </Text>
        </Pressable>

        <View className="ml-3 flex-1">
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

      <View className="flex-row items-center space-x-1.5">
        <Text className="text-sm">📍</Text>
        <Text 
          className="text-base text-[#1B3B36]"
          style={{ fontFamily: 'Outfit_700Bold' }}
        >
          {school.numSpots ?? 0}
        </Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { schools } = useSchools();
  const { favoriteSchoolIds, toggleFavoriteSchool } = useFavorites();

  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedSchool = schools.find(
    (school: School) => school.id === selectedSchoolId
  );

  const favoriteSchools = favoriteSchoolIds
    .map((schoolId) =>
      schools.find((school: School) => school.id === schoolId)
    )
    .filter((school): school is School => !!school);

  const filteredSchools = schools.filter((school: School) =>
    school.name
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase())
  );

  const sortedFilteredSchools = [
    ...filteredSchools.filter((school: School) =>
      favoriteSchoolIds.includes(school.id)
    ),
    ...filteredSchools.filter(
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

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setIsOpen(true);

    if (selectedSchool && text !== selectedSchool.name) {
      setSelectedSchoolId('');
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedSchoolId('');
    setIsOpen(false);
    Keyboard.dismiss();
  };

  const handleSchoolSelect = (school: School) => {
    setSelectedSchoolId(school.id);
    setSearchQuery(school.name);
    setIsOpen(false);
  };

  const handleFavoritePress = (
    event: GestureResponderEvent,
    schoolId: string
  ) => {
    event.stopPropagation();
    toggleFavoriteSchool(schoolId);
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
      },
    });
  };

  return (
    <View className="flex-1 bg-white">
      {/* Top Header Banner Section */}
      <View className="bg-[#1B3B36] pt-25 pb-8 px-6 flex-row items-center justify-between">
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
            Welcome back!
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
          <View className="absolute left-4 top-2.5 z-10">
            <Text className="text-xl text-slate-400">🔍</Text>
          </View>
          <TextInput
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={() => setIsOpen(true)}
            onPressIn={() => setIsOpen(true)}
            placeholder="Search all schools..."
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
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {favoriteSchools.map((school: School) => (
                  <SchoolRow
                    key={school.id}
                    school={school}
                    isFavorite
                    onSelect={handleSchoolSelect}
                    onFavoritePress={handleFavoritePress}
                  />
                ))}
              </ScrollView>
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
                {sortedFilteredSchools.length} schools found
              </Text>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {schools.length > 0 ? (
                sortedFilteredSchools.length > 0 ? (
                  sortedFilteredSchools.map((school: School) => (
                    <SchoolRow
                      key={school.id}
                      school={school}
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
                )
              ) : (
                <Text 
                  className="px-4 py-4 text-base text-slate-400 bg-white"
                  style={{ fontFamily: 'Outfit_500Medium' }}
                >
                  Loading schools...
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