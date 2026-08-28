import { usePathname, useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';

const DEFAULT_WINDOW_MS = 800;
const GLOBAL_LOCK_MS = 2500;
const BACK_WINDOW_MS = 450;
const recentKeys = new Map<string, number>();
let globalLockUntil = 0;
let inNavigateCallback = false;

type GuardOptions = {
  useGlobalLock?: boolean;
};

export function hrefKey(href: Href): string {
  if (typeof href === 'string') {
    return href.split('?')[0] || href;
  }

  if (typeof href === 'object' && href && 'pathname' in href && href.pathname) {
    return String(href.pathname);
  }

  return 'unknown';
}

export function canStartGuardedAction(
  key: string,
  now = Date.now(),
  windowMs = DEFAULT_WINDOW_MS
): boolean {
  const last = recentKeys.get(key) ?? 0;
  if (now - last < windowMs) {
    return false;
  }
  recentKeys.set(key, now);
  return true;
}

export function releaseNavigationLock(): void {
  globalLockUntil = 0;
}

export function resetNavigationGuard(): void {
  recentKeys.clear();
  globalLockUntil = 0;
  inNavigateCallback = false;
}

export function guardedNavigate(
  key: string,
  navigate: () => void,
  windowMs = DEFAULT_WINDOW_MS,
  options: GuardOptions = {}
): boolean {
  if (inNavigateCallback) {
    navigate();
    return true;
  }

  const useGlobalLock = options.useGlobalLock !== false;
  const now = Date.now();
  if (useGlobalLock && now < globalLockUntil) {
    globalLockUntil = now + GLOBAL_LOCK_MS;
    return false;
  }

  if (!canStartGuardedAction(key, now, windowMs)) {
    return false;
  }

  if (useGlobalLock) {
    globalLockUntil = now + GLOBAL_LOCK_MS;
  }
  inNavigateCallback = true;
  try {
    navigate();
  } finally {
    inNavigateCallback = false;
  }
  return true;
}

export function useGuardedRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  const pathname = usePathname();

  return useMemo(() => {
    const push: typeof router.push = (href, options) => {
      const dest = hrefKey(href as Href);
      guardedNavigate(dest, () => {
        if (dest === pathname) {
          router.navigate(href as Href);
          return;
        }
        router.push(href, options);
      });
    };
    const back: typeof router.back = () => {
      guardedNavigate(
        'back',
        () => {
          router.back();
        },
        BACK_WINDOW_MS,
        { useGlobalLock: false }
      );
    };

    return { ...router, push, back };
  }, [pathname, router]);
}
