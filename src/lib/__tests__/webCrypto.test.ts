import { createHash } from 'crypto';
import { createRandomId, sha256Hex } from '../webCrypto';

describe('webCrypto helpers', () => {
  it('hashes the same hex digest as Node sha256', async () => {
    const value = 'delete-account-proof';
    const expected = createHash('sha256').update(value).digest('hex');
    await expect(sha256Hex(value)).resolves.toBe(expected);
  });

  it('returns a UUID string', () => {
    expect(createRandomId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
