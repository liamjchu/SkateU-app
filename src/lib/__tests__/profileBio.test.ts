import {
  PROFILE_BIO_MAX,
  getProfileBioError,
  isProfileBioValid,
  normalizeProfileBio,
  prefilterProfileBio,
} from '../profileBio';

describe('normalizeProfileBio', () => {
  it('stores blank bios as null', () => {
    expect(normalizeProfileBio('   ')).toBeNull();
    expect(normalizeProfileBio('Skater at State')).toBe('Skater at State');
  });
});

describe('getProfileBioError', () => {
  it('allows an empty bio and bios up to the max', () => {
    expect(getProfileBioError('')).toBeNull();
    expect(getProfileBioError('a'.repeat(PROFILE_BIO_MAX))).toBeNull();
    expect(isProfileBioValid('ig: liam')).toBe(true);
  });

  it('rejects bios over the max length', () => {
    expect(getProfileBioError('a'.repeat(PROFILE_BIO_MAX + 1))).toContain(
      String(PROFILE_BIO_MAX)
    );
  });
});

describe('prefilterProfileBio', () => {
  it('allows ordinary skate talk and social plugs', () => {
    expect(prefilterProfileBio('Skater at State. IG: liam')).toEqual({ ok: true });
    expect(prefilterProfileBio('this is fucking sick')).toEqual({ ok: true });
  });

  it('rejects slurs, PII-looking numbers, and spam', () => {
    expect(prefilterProfileBio('retard ledge').ok).toBe(false);
    expect(prefilterProfileBio('123456789').ok).toBe(false);
    expect(prefilterProfileBio('aaaaaaaaaaaa').ok).toBe(false);
    expect(prefilterProfileBio('aaaaaaaaaaaa')).toEqual({
      ok: false,
      reason: 'That reads like spam — try a real bio.',
    });
  });
});
