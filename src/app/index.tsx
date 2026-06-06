import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, TextInput, View, type GestureResponderEvent } from 'react-native';
import { useFavorites } from '../store/favoritesStore';
import { useSchools } from '../store/schoolsStore';
import type { School } from '../types/school';

export default function HomeScreen() {
  const router = useRouter();
  const { schools } = useSchools();
  const { favoriteSchoolIds, toggleFavoriteSchool } = useFavorites();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedSchool = schools.find((school: School) => school.id === selectedSchoolId);
  const favoriteSchools = favoriteSchoolIds
    .map((schoolId) => schools.find((school: School) => school.id === schoolId))
    .filter((school): school is School => !!school);
  const filteredSchools = schools.filter((school: School) =>
    school.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const sortedFilteredSchools = [
    ...filteredSchools.filter((school: School) => favoriteSchoolIds.includes(school.id)),
    ...filteredSchools.filter((school: School) => !favoriteSchoolIds.includes(school.id)),
  ];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

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
      },
    });
  };

  const handleSchoolSelect = (school: School) => {
    setSelectedSchoolId(school.id);
    setSearchQuery(school.name);
    setIsOpen(false);
  };

  const handleFavoritePress = (event: GestureResponderEvent, schoolId: string) => {
    event.stopPropagation();
    toggleFavoriteSchool(schoolId);
  };

  return (
    <View className="flex-1 justify-between bg-white px-4 pt-20 pb-8">
      <View className="w-full max-w-md mx-auto flex-1 relative">
        <Text className="mb-8 text-3xl font-bold text-slate-900">{greeting}</Text>

        <Text className="mb-3 text-base font-semibold text-slate-900">Select your school</Text>

        {/* Input area */}
        <View className="relative mb-6">
          <TextInput
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={() => setIsOpen(true)}
            onPressIn={() => setIsOpen(true)}
            placeholder="Search schools..."
            placeholderTextColor="#64748b"
            className="rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-4 pr-14 text-base text-slate-900"
          />
          <Pressable
            onPress={handleClearSearch}
            className="absolute right-2 top-2 h-10 w-10 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Clear school search"
          >
            <Text className="text-xl font-semibold text-slate-400">x</Text>
          </Pressable>
        </View>

        {/* Favorites Section */}
        {favoriteSchools.length > 0 ? (
          <View className="z-0">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-slate-900">Favorites</Text>
              <Text className="text-sm font-medium text-slate-500">
                {favoriteSchools.length} {favoriteSchools.length === 1 ? 'school' : 'schools'}
              </Text>
            </View>
            <View className="max-h-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <ScrollView 
                nestedScrollEnabled 
                showsVerticalScrollIndicator
                scrollEnabled={!isOpen}
              >
                {favoriteSchools.map((school: School) => (
                  <Pressable
                    key={school.id}
                    onPress={() => handleSchoolSelect(school)}
                    className="border-b border-slate-100 px-4 py-4 flex-row items-center justify-between"
                  >
                    <View className="flex-1 pr-3">
                      <Text className="text-base text-slate-900">{school.name}</Text>
                      <Text className="mt-1 text-sm text-slate-500">
                        {school.city}, {school.state}
                      </Text>
                      <Text className="mt-1 text-sm text-slate-500">
                        {school.numSpots ?? 0} {school.numSpots === 1 ? 'spot' : 'spots'}
                      </Text>
                    </View>

                    <Pressable
                      onPress={(event) => handleFavoritePress(event, school.id)}
                      className="h-10 w-10 items-center justify-center rounded-full bg-slate-50"
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${school.name} from favorites`}
                    >
                      <Text className="text-2xl text-amber-400">★</Text>
                    </Pressable>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        ) : null}

        {/* Dropdown Menu moved to the absolute root layout level of the upper layout.
          Top positioning aligns it cleanly right below the label and input.
        */}
        {isOpen ? (
          <View 
            pointerEvents="auto"
            className="absolute left-0 right-0 top-36 max-h-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl z-50"
          >
            <ScrollView 
              keyboardShouldPersistTaps="handled" 
              nestedScrollEnabled 
              showsVerticalScrollIndicator
            >
              {schools.length > 0 ? (
                sortedFilteredSchools.length > 0 ? (
                  sortedFilteredSchools.map((school: School) => (
                    <Pressable
                      key={school.id}
                      onPress={() => handleSchoolSelect(school)}
                      className="border-b border-slate-100 px-4 py-4 flex-row items-center justify-between bg-white"
                    >
                      <View className="flex-1 pr-3">
                        <Text className="text-base text-slate-900">{school.name}</Text>
                        <Text className="mt-1 text-sm text-slate-500">
                          {school.city}, {school.state}
                        </Text>
                        <Text className="mt-1 text-sm text-slate-500">
                          {school.numSpots ?? 0} {school.numSpots === 1 ? 'spot' : 'spots'}
                        </Text>
                      </View>

                      <Pressable
                        onPress={(event) => handleFavoritePress(event, school.id)}
                        className="h-10 w-10 items-center justify-center rounded-full bg-slate-50"
                        accessibilityRole="button"
                        accessibilityLabel={
                          favoriteSchoolIds.includes(school.id)
                            ? `Remove ${school.name} from favorites`
                            : `Add ${school.name} to favorites`
                        }
                      >
                        <Text
                          className={`text-2xl ${
                            favoriteSchoolIds.includes(school.id) ? 'text-amber-400' : 'text-slate-300'
                          }`}
                        >
                          {favoriteSchoolIds.includes(school.id) ? '★' : '☆'}
                        </Text>
                      </Pressable>
                    </Pressable>
                  ))
                ) : (
                  <Text className="px-4 py-4 text-base text-slate-500 bg-white">No schools found</Text>
                )
              ) : (
                <Text className="px-4 py-4 text-base text-slate-500 bg-white">Loading schools...</Text>
              )}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={handleGoPress}
        disabled={!selectedSchool}
        className={`mx-auto w-full max-w-md rounded-2xl px-6 py-4 mt-4 ${selectedSchool ? 'bg-slate-900' : 'bg-slate-400'}`}
      >
        <Text className="text-center text-base font-semibold text-white">Go</Text>
      </Pressable>
    </View>
  );
}