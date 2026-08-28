const mockDigest = jest.fn(
  async (algorithm: string, data: BufferSource): Promise<ArrayBuffer> => {
    const { createHash } = require('crypto') as typeof import('crypto');
    const hashName = algorithm.replace('-', '').toLowerCase();
    const bytes =
      data instanceof ArrayBuffer
        ? Buffer.from(data)
        : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const digest = createHash(hashName).update(bytes).digest();
    return digest.buffer.slice(
      digest.byteOffset,
      digest.byteOffset + digest.byteLength
    );
  }
);

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: {
    SHA1: 'SHA-1',
    SHA256: 'SHA-256',
    SHA384: 'SHA-384',
    SHA512: 'SHA-512',
  },
  digest: (algorithm: string, data: BufferSource) => mockDigest(algorithm, data),
  getRandomValues: <T extends ArrayBufferView>(typedArray: T): T => {
    const { randomBytes } = require('crypto') as typeof import('crypto');
    const fill = randomBytes(typedArray.byteLength);
    new Uint8Array(
      typedArray.buffer,
      typedArray.byteOffset,
      typedArray.byteLength
    ).set(fill);
    return typedArray;
  },
  randomUUID: () => {
    const { randomUUID } = require('crypto') as typeof import('crypto');
    return randomUUID();
  },
}));

import { createHash } from 'crypto';
import { ensureWebCrypto, hasWebCryptoDigest } from '../ensureWebCrypto';

const originalCrypto = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    enumerable: true,
    value: originalCrypto,
  });
  mockDigest.mockClear();
});

describe('ensureWebCrypto', () => {
  it('leaves an existing subtle.digest implementation in place', () => {
    expect(hasWebCryptoDigest()).toBe(true);

    ensureWebCrypto();

    expect(hasWebCryptoDigest()).toBe(true);
    expect(mockDigest).not.toHaveBeenCalled();
  });

  it('installs SHA-256 digest when WebCrypto subtle is missing', async () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: true,
      value: {
        getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
        randomUUID: originalCrypto.randomUUID.bind(originalCrypto),
      },
    });

    expect(hasWebCryptoDigest()).toBe(false);

    ensureWebCrypto();

    expect(hasWebCryptoDigest()).toBe(true);

    const value = 'skateu-pkce-verifier';
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(value)
    );
    const hex = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');

    expect(hex).toBe(createHash('sha256').update(value).digest('hex'));
    expect(mockDigest).toHaveBeenCalled();
  });

  it('satisfies the Supabase PKCE WebCrypto support check', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: true,
      value: {
        getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
      },
    });

    ensureWebCrypto();

    expect(
      typeof globalThis.crypto !== 'undefined' &&
        typeof globalThis.crypto.subtle !== 'undefined' &&
        typeof TextEncoder !== 'undefined'
    ).toBe(true);
  });

  it('accepts an AlgorithmIdentifier object for digest', async () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: true,
      value: {
        getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
        randomUUID: originalCrypto.randomUUID.bind(originalCrypto),
      },
    });

    ensureWebCrypto();

    const digest = await globalThis.crypto.subtle.digest(
      { name: 'SHA-256' },
      new TextEncoder().encode('skateu')
    );
    expect(digest.byteLength).toBeGreaterThan(0);
  });

  it('replaces global crypto when the existing object rejects subtle', async () => {
    const frozen = Object.freeze({
      getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
      randomUUID: originalCrypto.randomUUID.bind(originalCrypto),
    });
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: true,
      value: frozen,
    });

    ensureWebCrypto();

    expect(hasWebCryptoDigest()).toBe(true);
    await expect(
      globalThis.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode('skateu')
      )
    ).resolves.toBeInstanceOf(ArrayBuffer);
  });

  it('installs expo-crypto fallbacks when global crypto is missing', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: true,
      value: undefined,
    });

    ensureWebCrypto();

    expect(hasWebCryptoDigest()).toBe(true);
    const bytes = new Uint8Array(4);
    expect(globalThis.crypto.getRandomValues(bytes)).toBe(bytes);
    expect(typeof globalThis.crypto.randomUUID()).toBe('string');
  });

  it('returns false when reading crypto throws', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      get() {
        throw new Error('crypto host object');
      },
    });

    expect(hasWebCryptoDigest()).toBe(false);
  });
});
