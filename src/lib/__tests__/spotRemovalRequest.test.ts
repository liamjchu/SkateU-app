import {
  SPOT_REMOVAL_DETAILS_MAX,
  getSpotRemovalDetailsError,
  isSpotRemovalReason,
  validateSpotRemovalRequestBody,
} from '../spotRemovalRequest';
import { validateSpotId } from '../../app/api/spots+api';

describe('isSpotRemovalReason', () => {
  it('accepts the supported reason slugs', () => {
    expect(isSpotRemovalReason('dangerous')).toBe(true);
    expect(isSpotRemovalReason('other')).toBe(true);
    expect(isSpotRemovalReason('nope')).toBe(false);
    expect(isSpotRemovalReason(1)).toBe(false);
  });
});

describe('getSpotRemovalDetailsError', () => {
  it('allows empty details', () => {
    expect(getSpotRemovalDetailsError('')).toBeNull();
    expect(getSpotRemovalDetailsError('   ')).toBeNull();
  });

  it('rejects details over the max length', () => {
    expect(
      getSpotRemovalDetailsError('a'.repeat(SPOT_REMOVAL_DETAILS_MAX + 1))
    ).toContain(String(SPOT_REMOVAL_DETAILS_MAX));
  });
});

describe('validateSpotRemovalRequestBody', () => {
  it('accepts a valid reason with optional details', () => {
    expect(
      validateSpotRemovalRequestBody(
        { spotId: 'spot-1', reason: 'duplicate', details: '  same as the other rail  ' },
        validateSpotId
      )
    ).toEqual({
      ok: true,
      value: {
        spotId: 'spot-1',
        reason: 'duplicate',
        details: 'same as the other rail',
      },
    });
  });

  it('rejects an invalid spot id and reason', () => {
    expect(
      validateSpotRemovalRequestBody({ spotId: '', reason: 'dangerous' }, validateSpotId)
        .ok
    ).toBe(false);
    expect(
      validateSpotRemovalRequestBody({ spotId: 'spot-1', reason: 'nope' }, validateSpotId)
    ).toEqual({
      ok: false,
      message: 'Choose what’s wrong with this spot.',
    });
  });
});
