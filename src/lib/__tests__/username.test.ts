import { slugifyUsername, validateUsername, USERNAME_MAX } from '../username';

describe('slugifyUsername', () => {
  it('drops punctuation and spaces, then lowercases', () => {
    expect(slugifyUsername("John O'Brien")).toBe('johnobrien');
    expect(slugifyUsername('Skate_U 2026')).toBe('skateu2026');
  });

  it('clips to the username max length', () => {
    expect(slugifyUsername('a'.repeat(USERNAME_MAX + 5))).toHaveLength(USERNAME_MAX);
  });
});

describe('validateUsername', () => {
  it('accepts a valid username', () => {
    expect(validateUsername('liam')).toBeNull();
    expect(validateUsername('skater_01')).toBeNull();
  });

  it('rejects too short, too long, and illegal characters', () => {
    expect(validateUsername('ab')).toBe('Must be at least 3 characters.');
    expect(validateUsername('a'.repeat(21))).toBe('Must be 20 characters or fewer.');
    expect(validateUsername('1skater')).toBe('Must start with a lowercase letter.');
    expect(validateUsername('Liam')).toBe('Must start with a lowercase letter.');
    expect(validateUsername('skate-u')).toBe(
      'Use lowercase letters, numbers, and underscores only.'
    );
  });
});
