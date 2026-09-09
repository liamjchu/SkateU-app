import { requireOptionalNativeModule } from 'expo-modules-core';

type ExpoLocationModule = typeof import('expo-location');

let cached: ExpoLocationModule | null | undefined;

export function getExpoLocation(): ExpoLocationModule | null {
  if (cached !== undefined) {
    return cached;
  }

  const nativeMissing =
    requireOptionalNativeModule('ExpoLocation') == null &&
    process.env.NODE_ENV !== 'test';

  if (nativeMissing) {
    cached = null;
  } else {
    try {
      cached = require('expo-location') as ExpoLocationModule;
    } catch {
      cached = null;
    }
  }

  return cached;
}
