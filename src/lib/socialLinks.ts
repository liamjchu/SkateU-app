import * as Linking from 'expo-linking';
import { Alert } from 'react-native';

export async function openSocialUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Couldn’t open that link', 'Please try again.');
  }
}
