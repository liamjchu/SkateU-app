import {
  PASSWORD_REQUIREMENTS,
  getPasswordRequirementStatus,
  validatePassword,
} from '../password';

describe('validatePassword', () => {
  it('accepts a password that meets every rule', () => {
    expect(validatePassword('SkateU1!')).toBeNull();
    expect(getPasswordRequirementStatus('SkateU1!')).toEqual({
      minLength: true,
      upperAndLowerCase: true,
      number: true,
      specialCharacter: true,
    });
  });

  it('rejects each missing requirement with a specific message', () => {
    expect(validatePassword('Ab1!')).toBe('Password needs at least 8 characters.');
    expect(validatePassword('skateu1!')).toBe(
      'Password needs uppercase and lowercase letters.'
    );
    expect(validatePassword('SKATEU1!')).toBe(
      'Password needs uppercase and lowercase letters.'
    );
    expect(validatePassword('SkateU!!')).toBe('Password needs a number.');
    expect(validatePassword('SkateU11')).toBe('Password needs a special character.');
  });

  it('describes the full policy for UI copy', () => {
    expect(PASSWORD_REQUIREMENTS).toContain('8 characters');
    expect(PASSWORD_REQUIREMENTS).toContain('special character');
  });
});
