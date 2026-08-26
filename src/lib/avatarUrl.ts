export const AVATAR_PUBLIC_PATH = '/storage/v1/object/public/avatars/';

export function isSkateUAvatarUrl(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  try {
    return new URL(value).pathname.includes(AVATAR_PUBLIC_PATH);
  } catch {
    return false;
  }
}

export function displayableAvatarUrl(
  value: string | null | undefined
): string | null {
  return isSkateUAvatarUrl(value) ? value ?? null : null;
}

export function avatarStorageKeyFromUrl(value: string): string | null {
  try {
    const pathname = new URL(value).pathname;
    const index = pathname.indexOf(AVATAR_PUBLIC_PATH);
    if (index < 0) {
      return null;
    }

    const key = decodeURIComponent(
      pathname.slice(index + AVATAR_PUBLIC_PATH.length)
    );
    return key.length > 0 ? key : null;
  } catch {
    return null;
  }
}
