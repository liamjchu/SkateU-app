import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

const APPLE_USER_ID_STORAGE_KEY = 'skateu.appleUserId';

export type AppleIdentityTokenPayload = {
  identityToken: string;
  user: string;
  fullName: AppleAuthentication.AppleAuthenticationFullName | null;
  email: string | null;
};

export async function storeAppleUserId(user: string): Promise<void> {
  await AsyncStorage.setItem(APPLE_USER_ID_STORAGE_KEY, user);
}

export async function checkAppleCredentialStatus(): Promise<AppleAuthentication.AppleAuthenticationCredentialState | null> {
  if (Platform.OS !== 'ios') {
    return null;
  }

  const user = await AsyncStorage.getItem(APPLE_USER_ID_STORAGE_KEY);
  if (!user) {
    return null;
  }

  const credentialState = await AppleAuthentication.getCredentialStateAsync(user);
  if (credentialState !== AppleAuthentication.AppleAuthenticationCredentialState.AUTHORIZED) {
    await AsyncStorage.removeItem(APPLE_USER_ID_STORAGE_KEY);
  }

  return credentialState;
}

export async function sendIdentityTokenToBackend({
  identityToken,
  user,
  fullName,
  email,
}: AppleIdentityTokenPayload): Promise<void> {
  void identityToken;
  void user;
  void fullName;
  void email;
  // TODO: Send this payload to your server, Supabase, Firebase, or other auth provider.
}
