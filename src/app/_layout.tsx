import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_900Black,
  useFonts
} from '@expo-google-fonts/outfit';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';
import '../../global.css';
import { SpotsProvider } from '../context/SpotsContext';

//SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // 1. PLACE THE ERROR CHECK HERE FIRST:
  if (fontError) {
    return <Text>Font Load Error: {fontError.message}</Text>;
  }

  // 2. This keeps the app loading until the fonts are ready
  if (!fontsLoaded) {
    return null;
  }

  // 3. FIXED: Wrapped Stack inside SpotsProvider so all screens can access spots data
  return (
    <SpotsProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SpotsProvider>
  );
}