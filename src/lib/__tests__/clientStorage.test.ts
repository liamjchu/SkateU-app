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
});
