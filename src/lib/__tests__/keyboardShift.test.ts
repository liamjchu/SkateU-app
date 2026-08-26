import { extraKeyboardPadding } from '../keyboardShift';

describe('extraKeyboardPadding', () => {
  it('adds no extra padding when the keyboard is closed', () => {
    expect(extraKeyboardPadding(0, 34)).toBe(0);
    expect(extraKeyboardPadding(-1, 12)).toBe(0);
  });

  it('subtracts closed bottom padding so the home indicator is not counted twice', () => {
    expect(extraKeyboardPadding(336, 34)).toBe(302);
    expect(extraKeyboardPadding(300, 12)).toBe(288);
  });

  it('does not go negative when closed padding is larger than the keyboard', () => {
    expect(extraKeyboardPadding(20, 34)).toBe(0);
  });

  it('uses the full keyboard height when there is no closed padding', () => {
    expect(extraKeyboardPadding(280, 0)).toBe(280);
  });
});
