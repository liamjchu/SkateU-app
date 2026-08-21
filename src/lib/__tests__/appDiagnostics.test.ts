import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { collectClientDiagnostics } from '../appDiagnostics';
import { METADATA_VALUE_MAX } from '../userFeedback';

describe('collectClientDiagnostics', () => {
  it('returns clipped string fields the server allowlists', () => {
    const diagnostics = collectClientDiagnostics('/help/bug');
    const keys = [
      'appVersion',
      'buildNumber',
      'platform',
      'osVersion',
      'deviceModel',
      'route',
    ] as const;

    for (const key of keys) {
      expect(typeof diagnostics[key]).toBe('string');
      expect(diagnostics[key].length).toBeLessThanOrEqual(METADATA_VALUE_MAX);
    }

    expect(diagnostics.platform.length).toBeGreaterThan(0);
    expect(diagnostics.route).toBe('/help/bug');
  });

  it('falls back to Platform.Version when the device OS is missing', () => {
    const osDescriptor = Object.getOwnPropertyDescriptor(Device, 'osVersion');
    const versionDescriptor = Object.getOwnPropertyDescriptor(Platform, 'Version');
    Object.defineProperty(Device, 'osVersion', {
      configurable: true,
      value: null,
    });
    Object.defineProperty(Platform, 'Version', {
      configurable: true,
      value: 34,
    });

    try {
      const diagnostics = collectClientDiagnostics();
      expect(diagnostics.osVersion).toBe('34');
      expect(diagnostics.route).toBe('');
    } finally {
      if (osDescriptor) {
        Object.defineProperty(Device, 'osVersion', osDescriptor);
      }
      if (versionDescriptor) {
        Object.defineProperty(Platform, 'Version', versionDescriptor);
      }
    }
  });
});
