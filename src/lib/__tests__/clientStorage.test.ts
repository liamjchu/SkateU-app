import { Platform } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { getClientStorage, isWebServerRendering } from '../clientStorage';

describe('getClientStorage', () => {
  it('uses AsyncStorage on native and can round-trip a value', async () => {
    expect(Platform.OS).not.toBe('web');
    expect(isWebServerRendering).toBe(false);

    const storage = getClientStorage();
    await storage.setItem('k', 'v');
    await expect(storage.getItem('k')).resolves.toBe('v');
    await storage.removeItem('k');
    await expect(storage.getItem('k')).resolves.toBeNull();
  });

  it('falls back when AsyncStorage is missing methods', async () => {
    jest.resetModules();
    jest.doMock('@react-native-async-storage/async-storage', () => ({}));
    const { getClientStorage } = require('../clientStorage') as typeof import('../clientStorage');
    const storage = getClientStorage();
    await expect(storage.getItem('k')).resolves.toBeNull();
    await expect(storage.setItem('k', 'v')).resolves.toBeUndefined();
    await expect(storage.removeItem('k')).resolves.toBeUndefined();
  });
});
