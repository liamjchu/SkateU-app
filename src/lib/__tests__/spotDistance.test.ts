import type { Spot } from '../../types/spot';
import {
    formatDistanceFromMeters,
    metersBetween,
    sortSpotsByDistanceFrom,
} from '../spotDistance';

function makeSpot(
  id: string,
  latitude: number,
  longitude: number
): Spot {
  return {
    id,
    name: id,
    description: '',
    latitude,
    longitude,
    imageUris: [],
    city: '',
    state: '',
    schoolName: '',
    creatorUsername: null,
    creatorAvatarUrl: null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('metersBetween', () => {
  it('returns 0 for the same point', () => {
    expect(
      metersBetween(
        { latitude: 40.71, longitude: -74.01 },
        { latitude: 40.71, longitude: -74.01 }
      )
    ).toBe(0);
  });

  it('measures ~111m per 0.001° longitude at the equator', () => {
    const meters = metersBetween(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0.001 }
    );
    expect(meters).toBeCloseTo(111.19, 0);
  });
});

describe('sortSpotsByDistanceFrom', () => {
  const origin = makeSpot('origin', 40.0, -74.0);
  const near = makeSpot('near', 40.001, -74.0);
  const far = makeSpot('far', 40.02, -74.0);
  const alsoNear = makeSpot('also-near', 40.001, -74.0);

  it('puts the origin first, then nearest neighbors', () => {
    expect(sortSpotsByDistanceFrom([far, origin, near], origin).map((s) => s.id)).toEqual([
      'origin',
      'near',
      'far',
    ]);
  });

  it('breaks equal-distance ties by id and keeps origin first', () => {
    expect(
      sortSpotsByDistanceFrom([alsoNear, near, origin], origin).map((s) => s.id)
    ).toEqual(['origin', 'also-near', 'near']);
  });

  it('still sorts by distance when origin is not in the list', () => {
    expect(sortSpotsByDistanceFrom([far, near], origin).map((s) => s.id)).toEqual([
      'near',
      'far',
    ]);
  });
});

describe('formatDistanceFromMeters', () => {
  it('labels overlapping spots as right here', () => {
    expect(formatDistanceFromMeters(0)).toBe('Right here');
    expect(formatDistanceFromMeters(10)).toBe('Right here');
  });

  it('uses rounded feet under 1000 ft', () => {
    expect(formatDistanceFromMeters(36.576)).toBe('~120 ft away');
  });

  it('uses miles for longer gaps', () => {
    expect(formatDistanceFromMeters(1609.344)).toBe('~1 mi away');
    expect(formatDistanceFromMeters(4828)).toBe('~3 mi away');
  });

  it('returns empty for invalid input', () => {
    expect(formatDistanceFromMeters(Number.NaN)).toBe('');
    expect(formatDistanceFromMeters(-1)).toBe('');
  });
});
