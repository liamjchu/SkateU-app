import { Platform } from 'react-native';

type ClientStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export const isWebServerRendering =
  Platform.OS === 'web' && typeof window === 'undefined';

const serverStorage: ClientStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

let clientStorage: ClientStorage | null = null;

export function getClientStorage(): ClientStorage {
  if (isWebServerRendering) {
    return serverStorage;
  }

  if (!clientStorage) {
    const storageModule = require('@react-native-async-storage/async-storage') as {
      default?: ClientStorage;
      getItem?: ClientStorage['getItem'];
      setItem?: ClientStorage['setItem'];
      removeItem?: ClientStorage['removeItem'];
    };
    const resolved =
      storageModule.default && typeof storageModule.default.getItem === 'function'
        ? storageModule.default
        : storageModule;

    if (
      typeof resolved.getItem !== 'function' ||
      typeof resolved.setItem !== 'function' ||
      typeof resolved.removeItem !== 'function'
    ) {
      return serverStorage;
    }

    clientStorage = {
      getItem: resolved.getItem.bind(resolved),
      setItem: resolved.setItem.bind(resolved),
      removeItem: resolved.removeItem.bind(resolved),
    };
  }

  return clientStorage;
}
