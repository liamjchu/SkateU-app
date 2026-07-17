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

/** Updates the password for the authenticated recovery session. */
export const updatePassword = async (password: string): Promise<void> => {
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw error;
  }
};
