import { formatSpotCount } from '../formatSpotCount';

describe('formatSpotCount', () => {
  it('prints exact counts below one thousand', () => {
    expect(formatSpotCount(0)).toBe('0');
    expect(formatSpotCount(999)).toBe('999');
  });

  it('uses one-decimal K and M abbreviations', () => {
    expect(formatSpotCount(1000)).toBe('1K');
    expect(formatSpotCount(1250)).toBe('1.2K');
    expect(formatSpotCount(1_000_000)).toBe('1M');
    expect(formatSpotCount(2_450_000)).toBe('2.4M');
  });
});
