import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

const SCHOOLS_DATABASE = [
  { id: '1', name: 'Brown University', lat: 41.8268, lng: -71.4010 },
  { id: '2', name: 'James W Robinson, Jr. Secondary School', lat: 38.8167, lng: -77.3025 },
  { id: '3', name: 'Trinity Christian School', lat: 38.8339, lng: -77.3324 },
  { id: '4', name: 'Bonnie Brae Elementary School', lat: 38.8035, lng: -77.3103 },
];

export default function HomeScreen() {
  const router = useRouter();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);

  const selectedSchool = SCHOOLS_DATABASE.find((school) => school.id === selectedSchoolId);

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
      },
    });
  };

  return (
    <View className="flex-1 justify-between bg-white px-4 pt-20 pb-8">
      <View className="w-full max-w-md mx-auto">
        <Text className="mb-3 text-base font-semibold text-slate-900">Select your school</Text>

        <Pressable
          onPress={() => setIsOpen((value) => !value)}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
        >
          <Text className="text-base text-slate-900">
            {selectedSchool ? selectedSchool.name : 'Choose a school'}
          </Text>
        </Pressable>

        {isOpen ? (
          <View className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {SCHOOLS_DATABASE.map((school) => (
              <Pressable
                key={school.id}
                onPress={() => {
                  setSelectedSchoolId(school.id);
                  setIsOpen(false);
                }}
                className="border-b border-slate-100 px-4 py-4"
              >
                <Text className="text-base text-slate-900">{school.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={handleGoPress}
        disabled={!selectedSchool}
        className={`mx-auto w-full max-w-md rounded-2xl px-6 py-4 ${selectedSchool ? 'bg-slate-900' : 'bg-slate-400'}`}
      >
        <Text className="text-center text-base font-semibold text-white">Go</Text>
      </Pressable>
    </View>
  );
}
