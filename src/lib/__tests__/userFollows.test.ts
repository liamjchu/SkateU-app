import { validateSpotId } from '../../app/api/spots+api';
import { validateFollowListParam, validateFollowUserBody } from '../userFollows';

const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('validateFollowUserBody', () => {
  it('accepts a valid user id', () => {
    expect(validateFollowUserBody({ userId }, validateSpotId)).toEqual({
      ok: true,
      value: { userId },
    });
  });

  it('rejects a missing user id', () => {
    const result = validateFollowUserBody({}, validateSpotId);
    expect(result.ok).toBe(false);
  });
});

describe('validateFollowListParam', () => {
  it('accepts followers and following', () => {
    expect(validateFollowListParam('followers')).toEqual({
      ok: true,
      value: 'followers',
    });
    expect(validateFollowListParam('following')).toEqual({
      ok: true,
      value: 'following',
    });
  });

  it('rejects other values', () => {
    expect(validateFollowListParam('friends').ok).toBe(false);
    expect(validateFollowListParam(null).ok).toBe(false);
  });
});
