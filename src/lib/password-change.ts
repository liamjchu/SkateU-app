import { supabase } from './supabase';

type ChangePasswordInput = {
  email: string;
  currentPassword: string;
  newPassword: string;
};

/**
 * Verifies the current email/password credentials before replacing the
 * password on the active Supabase session.
 */
export const changePassword = async ({
  email,
  currentPassword,
  newPassword,
}: ChangePasswordInput): Promise<void> => {
  const { error: reauthenticationError } =
    await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: currentPassword,
    });

  if (reauthenticationError) {
    if (/invalid login credentials/i.test(reauthenticationError.message)) {
      throw new Error('Incorrect current password.');
    }

    throw reauthenticationError;
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    throw updateError;
  }
};
