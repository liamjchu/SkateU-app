import * as Linking from 'expo-linking';
import { supabase } from './supabase';

/** Sends Supabase's password-recovery email to the app's recovery callback. */
export const requestPasswordResetEmail = async (email: string): Promise<void> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: Linking.createURL('auth/reset-password'),
  });

  if (error) {
    throw error;
  }
};

/** Updates the password only for an active Supabase recovery session. */
export const updatePassword = async (
  password: string,
  isPasswordRecovery: boolean
): Promise<void> => {
  if (!isPasswordRecovery) {
    throw new Error('Password recovery is required to reset your password.');
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw error;
  }
};
