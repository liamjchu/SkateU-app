type DigestFn = (
  algorithm: AlgorithmIdentifier,
  data: BufferSource
) => Promise<ArrayBuffer>;

export function hasWebCryptoDigest(): boolean {
  try {
    return typeof globalThis.crypto?.subtle?.digest === 'function';
  } catch {
    return false;
  }
}

function algorithmName(algorithm: AlgorithmIdentifier): string {
  return typeof algorithm === 'string' ? algorithm : algorithm.name;
}

// Hermes on older iPhones (iPhone 6s Plus / iOS 15) often has
// crypto.getRandomValues but no crypto.subtle. Supabase PKCE then falls
// back to a plaintext code challenge. Fill subtle.digest with expo-crypto
// so Google sign-in uses SHA-256 like every other platform.
export function ensureWebCrypto(): void {
  if (hasWebCryptoDigest()) {
    return;
  }

  // Lazy require so web SSR / Jest never loads the native module when the
  // runtime already has WebCrypto (Node, modern browsers, newer Hermes).
  const Crypto = require('expo-crypto') as typeof import('expo-crypto');

  const digest: DigestFn = (algorithm, data) => {
    const name = algorithmName(algorithm);
    return Crypto.digest(
      name as import('expo-crypto').CryptoDigestAlgorithm,
      data
    );
  };

  const subtle = { digest } as SubtleCrypto;
  const current = globalThis.crypto;

  try {
    if (current) {
      Object.defineProperty(current, 'subtle', {
        configurable: true,
        value: subtle,
      });
      if (hasWebCryptoDigest()) {
        return;
      }
    }
  } catch {
    // Native Crypto host objects can reject new properties.
  }

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    enumerable: true,
    value: {
      getRandomValues:
        current?.getRandomValues?.bind(current) ??
        Crypto.getRandomValues.bind(Crypto),
      randomUUID:
        current?.randomUUID?.bind(current) ?? Crypto.randomUUID.bind(Crypto),
      subtle,
    },
  });
}
