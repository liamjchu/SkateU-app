import {
  boundingBoxFilter,
  boundingBoxFor,
  MAX_LATITUDE,
  MAX_LONGITUDE,
  milesToMeters,
  NEARBY_REFETCH_METERS,
  parseCoordinate,
  parseNearbyOrigin,
  schoolDistanceMeters,
  shouldRefetchNearby,
  sortSchoolsByDistance,
  type NearbyOrigin,
} from '../nearbySchools';
import type { School } from '../../types/school';

const AUSTIN: NearbyOrigin = { latitude: 30.2672, longitude: -97.7431 };

function makeSchool(id: string, lat: number, lng: number): School {
  return {
    id,
    name: `School ${id}`,
    lat,
    lng,
    city: 'Austin',
    state: 'TX',
    numSpots: 0,
  };
}

describe('boundingBoxFor', () => {
  it('contains every point inside the requested radius', () => {
    const radiusMiles = 25;
    const box = boundingBoxFor(AUSTIN, radiusMiles);
    const radiusMeters = milesToMeters(radiusMiles);

    // Sample the circle's rim; each point must fall inside the box.
    for (let bearing = 0; bearing < 360; bearing += 15) {
      const radians = (bearing * Math.PI) / 180;
      const latOffset = (radiusMiles / 69.0932) * Math.cos(radians);
      const lngOffset =
        ((radiusMiles / 69.0932) /
          Math.cos((AUSTIN.latitude * Math.PI) / 180)) *
        Math.sin(radians);
      const point = {
        lat: AUSTIN.latitude + latOffset,
        lng: AUSTIN.longitude + lngOffset,
      };

      expect(schoolDistanceMeters(AUSTIN, point)).toBeLessThanOrEqual(
        radiusMeters * 1.01
      );
      expect(point.lat).toBeGreaterThanOrEqual(box.minLat);
      expect(point.lat).toBeLessThanOrEqual(box.maxLat);
      expect(point.lng).toBeGreaterThanOrEqual(box.minLng);
      expect(point.lng).toBeLessThanOrEqual(box.maxLng);
    }
  });

  it('widens longitude at higher latitudes for the same radius', () => {
    const anchorage = boundingBoxFor(
      { latitude: 61.2181, longitude: -149.9003 },
      25
    );
    const austin = boundingBoxFor(AUSTIN, 25);

    expect(anchorage.maxLng - anchorage.minLng).toBeGreaterThan(
      austin.maxLng - austin.minLng
    );
    expect(anchorage.maxLat - anchorage.minLat).toBeCloseTo(
      austin.maxLat - austin.minLat,
      6
    );
  });

  it('falls back to the full longitude range near the antimeridian', () => {
    const box = boundingBoxFor({ latitude: 52.9, longitude: -179.9 }, 100);

    expect(box.minLng).toBe(-MAX_LONGITUDE);
    expect(box.maxLng).toBe(MAX_LONGITUDE);
    expect(box.minLat).toBeLessThan(52.9);
    expect(box.maxLat).toBeGreaterThan(52.9);
  });

  it('clamps latitude and opens longitude when the box crosses a pole', () => {
    const box = boundingBoxFor({ latitude: 89.5, longitude: 20 }, 400);

    expect(box.maxLat).toBe(MAX_LATITUDE);
    expect(box.minLat).toBeGreaterThanOrEqual(-MAX_LATITUDE);
    expect(box.minLng).toBe(-MAX_LONGITUDE);
    expect(box.maxLng).toBe(MAX_LONGITUDE);
  });

  it('handles the equator without dividing by a vanishing cosine', () => {
    const box = boundingBoxFor({ latitude: 0, longitude: 0 }, 25);

    expect(box.maxLng - box.minLng).toBeCloseTo(box.maxLat - box.minLat, 6);
    expect(Number.isFinite(box.minLng)).toBe(true);
  });
});

describe('boundingBoxFilter', () => {
  it('renders a single PostgREST and=(...) clause with fixed precision', () => {
    const filter = boundingBoxFilter({
      minLat: 29.9,
      maxLat: 30.6,
      minLng: -98.1,
      maxLng: -97.3,
    });

    expect(filter).toBe(
      '(latitude.gte.29.900000,latitude.lte.30.600000,longitude.gte.-98.100000,longitude.lte.-97.300000)'
    );
  });
});

describe('parseCoordinate', () => {
  it.each([
    ['30.2672', 30.2672],
    ['  -97.7431  ', -97.7431],
    ['0', 0],
    ['-0', -0],
  ])('accepts %s', (raw, expected) => {
    expect(parseCoordinate(raw, 180)).toBe(expected);
  });

  it.each([null, '', '   ', 'abc', 'NaN', 'Infinity', '181', '-181'])(
    'rejects %s',
    (raw) => {
      expect(parseCoordinate(raw, 180)).toBeNull();
    }
  );
});

describe('parseNearbyOrigin', () => {
  it('returns the origin when both coordinates are in range', () => {
    expect(parseNearbyOrigin('30.2672', '-97.7431')).toEqual(AUSTIN);
  });

  it.each([
    ['91', '0'],
    ['0', '181'],
    [null, '0'],
    ['0', null],
    ['not-a-number', '0'],
  ])('returns null for lat=%s lng=%s', (lat, lng) => {
    expect(parseNearbyOrigin(lat, lng)).toBeNull();
  });
});

describe('sortSchoolsByDistance', () => {
  it('orders schools closest first', () => {
    const schools = [
      makeSchool('far', 32.7767, -96.797),
      makeSchool('near', 30.2849, -97.7341),
      makeSchool('mid', 29.7604, -95.3698),
    ];

    expect(
      sortSchoolsByDistance(AUSTIN, schools).map((school) => school.id)
    ).toEqual(['near', 'mid', 'far']);
  });

  it('breaks ties on id and leaves the input untouched', () => {
    const schools = [
      makeSchool('b', 30.3, -97.8),
      makeSchool('a', 30.3, -97.8),
    ];
    const original = [...schools];

    expect(
      sortSchoolsByDistance(AUSTIN, schools).map((school) => school.id)
    ).toEqual(['a', 'b']);
    expect(schools).toEqual(original);
  });

  it('keeps extra fields on the passed shape', () => {
    const rows = [{ id: 'a', lat: 30.3, lng: -97.8, numspots: 4 }];

    expect(sortSchoolsByDistance(AUSTIN, rows)[0]?.numspots).toBe(4);
  });
});

describe('shouldRefetchNearby', () => {
  it('refetches when there is no previous origin', () => {
    expect(shouldRefetchNearby(null, AUSTIN)).toBe(true);
  });

  it('skips a refetch for movement under the threshold', () => {
    const nudged = { ...AUSTIN, latitude: AUSTIN.latitude + 0.001 };

    expect(schoolDistanceMeters(AUSTIN, { lat: nudged.latitude, lng: nudged.longitude })).toBeLessThan(
      NEARBY_REFETCH_METERS
    );
    expect(shouldRefetchNearby(AUSTIN, nudged)).toBe(false);
  });

  it('refetches once the user moves past the threshold', () => {
    const moved = { ...AUSTIN, latitude: AUSTIN.latitude + 0.05 };

    expect(shouldRefetchNearby(AUSTIN, moved)).toBe(true);
  });
});
