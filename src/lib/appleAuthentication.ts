import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { getClientStorage } from './clientStorage';
import { supabase } from './supabase';

const APPLE_USER_ID_STORAGE_KEY = 'skateu.appleUserId';
const appleUserIdStorage = getClientStorage();

export type AppleIdentityTokenPayload = {
  identityToken: string;
  user: string;
  nonce: string;
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

export async function signInWithAppleIdentityToken({
  identityToken,
  user,
  nonce,
}: AppleIdentityTokenPayload): Promise<void> {
  // Supabase Auth validates the Apple JWT's issuer, audience, expiration,
  // signature, and nonce before exchanging it for the app session.
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
    nonce,
  });

  if (error) {
    throw error;
  }
  if (!data.session) {
    throw new Error('Could not create an app session. Please try again.');
  }

  await storeAppleUserId(user);
}
