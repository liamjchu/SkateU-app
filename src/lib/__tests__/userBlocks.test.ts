import { validateSpotId } from '../../app/api/spots+api';
import { validateBlockUserBody } from '../userBlocks';

const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('validateBlockUserBody', () => {
  it('accepts a valid user id', () => {
    expect(validateBlockUserBody({ userId }, validateSpotId)).toEqual({
      ok: true,
      value: { userId },
    });
  });

  it('rejects a missing user id', () => {
    const result = validateBlockUserBody({}, validateSpotId);
    expect(result.ok).toBe(false);
  });
});
