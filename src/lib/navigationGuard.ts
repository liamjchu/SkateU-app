const DEFAULT_WINDOW_MS = 800;
const recentKeys = new Map<string, number>();

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

export function guardedNavigate(
  key: string,
  navigate: () => void,
  windowMs = DEFAULT_WINDOW_MS
): boolean {
  if (!canStartGuardedAction(key, Date.now(), windowMs)) {
    return false;
  }
  navigate();
  return true;
}

export function resetNavigationGuard(): void {
  recentKeys.clear();
}
