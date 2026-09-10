import type { School } from '../../types/school';
import type { Spot } from '../../types/spot';
import {
    ADD_SPOT_NEAREST_SCHOOL_MAX_METERS,
    DEFAULT_MAP_CENTER,
    densestSchool,
    MAP_EXPLORE_CHROME_CONTENT_HEIGHT,
    nearestSchool,
    nearestSchoolWithin,
    parseMapRouteFocus,
    schoolFromSpot,
} from '../mapFocus';

function makeSchool(
  id: string,
  numSpots: number,
  lat = 40,
  lng = -74
): School {
  return {
    id,
    name: `School ${id}`,
    lat,
    lng,
    city: 'New York',
    state: 'NY',
    numSpots,
  };
}

function makeSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: 'spot-1',
    name: 'Ledge',
    description: '',
    latitude: 41.82,
    longitude: -71.4,
    imageUris: [],
    city: 'Providence',
    state: 'RI',
    schoolName: 'Brown',
    schoolId: 'brown',
    creatorUsername: null,
    creatorAvatarUrl: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('MAP_EXPLORE_CHROME_CONTENT_HEIGHT', () => {
  it('leaves room for the search pill and campus chip', () => {
    expect(MAP_EXPLORE_CHROME_CONTENT_HEIGHT).toBe(108);
  });
});

describe('densestSchool', () => {
  it('returns null for an empty catalog', () => {
    expect(densestSchool([])).toBeNull();
  });

  it('picks the school with the most spots and breaks ties by id', () => {
    expect(
      densestSchool([
        makeSchool('b', 4),
        makeSchool('a', 9),
        makeSchool('c', 9),
      ])?.id
    ).toBe('a');
  });
});

describe('nearestSchool', () => {
  it('returns the geographically closest school with no radius cap', () => {
    const origin = { latitude: 40, longitude: -74 };
    expect(
      nearestSchool(
        [makeSchool('far', 1, 0, 0), makeSchool('near', 1, 40.01, -74)],
        origin
      )?.id
    ).toBe('near');
  });
});

describe('nearestSchoolWithin', () => {
  it('returns the closest school inside the radius', () => {
    const origin = { latitude: 40, longitude: -74 };
    expect(
      nearestSchoolWithin(
        [makeSchool('far', 1, 41, -74), makeSchool('near', 1, 40.01, -74)],
        origin
      )?.id
    ).toBe('near');
  });

  it('returns null when nothing is close enough', () => {
    expect(
      nearestSchoolWithin(
        [makeSchool('far', 1, 0, 0)],
        { latitude: 40, longitude: -74 },
        ADD_SPOT_NEAREST_SCHOOL_MAX_METERS
      )
    ).toBeNull();
  });
});

describe('parseMapRouteFocus', () => {
  it('builds a campus focus from school params', () => {
    const parsed = parseMapRouteFocus(
      {
        schoolId: 'brown',
        schoolName: 'Brown',
        schoolCity: 'Providence',
        schoolState: 'RI',
        lat: '41.82',
        lng: '-71.4',
        spotId: 'spot-1',
      },
      []
    );

    expect(parsed?.school?.id).toBe('brown');
    expect(parsed?.latitude).toBe(41.82);
    expect(parsed?.spotId).toBe('spot-1');
  });

  it('ignores leftover coordinates when no school or spot is present', () => {
    expect(
      parseMapRouteFocus({ lat: '41.82', lng: '-71.4' }, [])
    ).toBeNull();
  });

  it('keeps a spot-only deep link on default coordinates', () => {
    const parsed = parseMapRouteFocus({ spotId: 'spot-1' }, []);
    expect(parsed).toEqual({
      school: null,
      latitude: DEFAULT_MAP_CENTER.latitude,
      longitude: DEFAULT_MAP_CENTER.longitude,
      spotId: 'spot-1',
    });
  });
});

describe('schoolFromSpot', () => {
  it('returns null when a spot has no campus', () => {
    expect(schoolFromSpot(makeSpot({ schoolId: undefined }))).toBeNull();
  });

  it('copies campus fields from the spot', () => {
    expect(schoolFromSpot(makeSpot())?.id).toBe('brown');
  });
});
