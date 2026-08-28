import { extraKeyboardPadding } from '../keyboardShift';

describe('extraKeyboardPadding', () => {
  it('adds no extra padding when the keyboard is closed', () => {
    expect(extraKeyboardPadding(0, 34)).toBe(0);
    expect(extraKeyboardPadding(-1, 12)).toBe(0);
  });

  it('uses the full keyboard height so the shifted child sits above the keyboard', () => {
    expect(extraKeyboardPadding(336, 34)).toBe(336);
    expect(extraKeyboardPadding(300, 12)).toBe(300);
  });

  it('still uses the keyboard height when it is smaller than closed padding', () => {
    expect(extraKeyboardPadding(20, 34)).toBe(20);
  });

  it('uses the full keyboard height when there is no closed padding', () => {
    expect(extraKeyboardPadding(280, 0)).toBe(280);
    expect(extraKeyboardPadding(280)).toBe(280);
  });
});
