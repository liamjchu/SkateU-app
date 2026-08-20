// Web Crypto helpers for Expo Router API routes. EAS Hosting runs on
// Cloudflare Workers, which do not provide Node's `crypto` module.

export function createRandomId(): string {
  return globalThis.crypto.randomUUID();
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}
