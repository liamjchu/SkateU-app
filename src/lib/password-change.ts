import { getApiUrl } from './api';
import { supabase } from './supabase';

type ChangePasswordInput = {
  email: string;
  currentPassword: string;
  newPassword: string;
};

type AuthErrorFields = {
  message: string;
  code: string;
  status: number | null;
  name: string;
  isErrorInstance: boolean;
};

export class PasswordChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordChangeError';
  }
}

function readAuthErrorFields(error: unknown): AuthErrorFields {
  const isErrorInstance = error instanceof Error;
  if (error && typeof error === 'object') {
    const record = error as {
      message?: unknown;
      code?: unknown;
      status?: unknown;
      name?: unknown;
    };
    return {
      message:
        typeof record.message === 'string'
          ? record.message
          : isErrorInstance
            ? error.message
            : String(error),
      code: typeof record.code === 'string' ? record.code : '',
      status: typeof record.status === 'number' ? record.status : null,
      name: typeof record.name === 'string' ? record.name : '',
      isErrorInstance,
    };
  }

  return {
    message: typeof error === 'string' ? error : '',
    code: '',
    status: null,
    name: '',
    isErrorInstance,
  };
}

function isCurrentPasswordRequiredError(error: unknown): boolean {
  const { code, message } = readAuthErrorFields(error);
  return (
    code === 'current_password_required' ||
    /current password required/i.test(message)
  );
}

export function toPasswordChangeErrorMessage(error: unknown): string {
  if (error instanceof PasswordChangeError) {
    return error.message;
  }

  const { message, code } = readAuthErrorFields(error);

  if (message === 'Incorrect current password.') {
    return message;
  }
  if (
    code === 'weak_password' ||
    /weak|leaked|pwned|easy to guess/i.test(message)
  ) {
    return 'That password is too easy to guess. Choose a different one.';
  }
  if (code === 'same_password' || /different from the old password/i.test(message)) {
    return 'Choose a password you have not used before.';
  }
  if (/session|jwt|token|expired|not authenticated/i.test(message)) {
    return 'Your session expired. Please log in again.';
  }
  if (/network|fetch|internet/i.test(message)) {
    return 'Check your internet connection and try again.';
  }

  return 'We couldn’t update your password right now. Please try again.';
}

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

const setPasswordViaAdminApi = async (
  accessToken: string,
  newPassword: string
): Promise<void> => {
  const response = await fetch(getApiUrl('/api/set-password'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: newPassword }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: unknown }
    | null;
  const errorMessage =
    payload && typeof payload.error === 'string' ? payload.error : '';

  if (!response.ok) {
    throw new PasswordChangeError(
      errorMessage || 'We couldn’t update your password right now. Please try again.'
    );
  }

  await supabase.auth.refreshSession();
};

/**
 * Adds an email/password credential to the signed-in user. Used when the
 * account currently only has an OAuth provider such as Google or Apple.
 */
export const setPassword = async (newPassword: string): Promise<void> => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (!error) {
    return;
  }

  if (isCurrentPasswordRequiredError(error)) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? '';
    if (!accessToken) {
      throw new PasswordChangeError('Your session expired. Please log in again.');
    }
    await setPasswordViaAdminApi(accessToken, newPassword);
    return;
  }

  throw error;
};
