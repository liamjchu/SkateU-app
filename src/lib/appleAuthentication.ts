import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { getClientStorage } from './clientStorage';

const APPLE_USER_ID_STORAGE_KEY = 'skateu.appleUserId';
const appleUserIdStorage = getClientStorage();

export type AppleIdentityTokenPayload = {
  identityToken: string;
  user: string;
  fullName: AppleAuthentication.AppleAuthenticationFullName | null;
  email: string | null;
};

export async function storeAppleUserId(user: string): Promise<void> {
  await appleUserIdStorage.setItem(APPLE_USER_ID_STORAGE_KEY, user);
}

export async function checkAppleCredentialStatus(): Promise<AppleAuthentication.AppleAuthenticationCredentialState | null> {
  if (Platform.OS !== 'ios') {
    return null;
  }

  const user = await appleUserIdStorage.getItem(APPLE_USER_ID_STORAGE_KEY);
  if (!user) {
    return null;
  }

  const credentialState = await AppleAuthentication.getCredentialStateAsync(user);
  if (credentialState !== AppleAuthentication.AppleAuthenticationCredentialState.AUTHORIZED) {
    await appleUserIdStorage.removeItem(APPLE_USER_ID_STORAGE_KEY);
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
