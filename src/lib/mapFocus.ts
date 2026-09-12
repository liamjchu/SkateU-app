import type { School } from '../types/school';
import type { Spot } from '../types/spot';
import { getApiUrl } from './api';
import {
  schoolDistanceMeters,
  sortSchoolsByDistance,
  type NearbyOrigin,
} from './nearbySchools';
import { parseSchools } from './readCache';

export const DEFAULT_MAP_CENTER = {
  latitude: 41.8268,
  longitude: -71.4010,
} as const;

export const ADD_SPOT_NEAREST_SCHOOL_MAX_METERS = 50_000;

/** Search pill plus campus chip below the safe area. Offsets banners and camera padding. */
export const MAP_EXPLORE_CHROME_CONTENT_HEIGHT = 108;

export function firstSearchParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return undefined;
}

export function densestSchool(schools: School[]): School | null {
  if (schools.length === 0) {
    return null;
  }

  return schools.reduce((best, school) => {
    if (school.numSpots !== best.numSpots) {
      return school.numSpots > best.numSpots ? school : best;
    }

    return school.id.localeCompare(best.id) < 0 ? school : best;
  });
}

export function nearestSchool(
  schools: School[],
  origin: NearbyOrigin
): School | null {
  return sortSchoolsByDistance(origin, schools)[0] ?? null;
}

export async function fetchNearestSchoolClient(
  latitude: number,
  longitude: number
): Promise<School | null> {
  const response = await fetch(
    getApiUrl(
      `/api/schools?nearest=1&lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`
    )
  );
  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as { schools?: unknown };
  return parseSchools(body.schools)[0] ?? null;
}

export function nearestSchoolWithin(
  schools: School[],
  origin: NearbyOrigin,
  maxMeters: number = ADD_SPOT_NEAREST_SCHOOL_MAX_METERS
): School | null {
  const nearest = sortSchoolsByDistance(origin, schools)[0];
  if (!nearest) {
    return null;
  }

  if (schoolDistanceMeters(origin, nearest) > maxMeters) {
    return null;
  }

  return nearest;
}

export type ParsedMapFocus = {
  school: School | null;
  latitude: number;
  longitude: number;
  spotId: string | null;
};

export function parseMapRouteFocus(
  params: Record<string, string | string[] | undefined>,
  catalog: School[]
): ParsedMapFocus | null {
  const schoolId = firstSearchParam(params.schoolId);
  const schoolName = firstSearchParam(params.schoolName);
  const spotId = firstSearchParam(params.spotId) ?? null;
  const latRaw = firstSearchParam(params.lat);
  const lngRaw = firstSearchParam(params.lng);
  const lat = latRaw != null ? Number(latRaw) : Number.NaN;
  const lng = lngRaw != null ? Number(lngRaw) : Number.NaN;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const schoolNumSpots = Number(firstSearchParam(params.schoolNumSpots) ?? '0');

  if (schoolId && schoolName) {
    const savedSchool = catalog.find((school) => school.id === schoolId);

    return {
      school: {
        id: schoolId,
        name: schoolName,
        lat: savedSchool?.lat ?? (hasCoords ? lat : DEFAULT_MAP_CENTER.latitude),
        lng: savedSchool?.lng ?? (hasCoords ? lng : DEFAULT_MAP_CENTER.longitude),
        city: savedSchool?.city ?? firstSearchParam(params.schoolCity) ?? '',
        state: savedSchool?.state ?? firstSearchParam(params.schoolState) ?? '',
        numSpots:
          savedSchool?.numSpots ??
          (Number.isFinite(schoolNumSpots) ? schoolNumSpots : 0),
        type: savedSchool?.type,
      },
      latitude: hasCoords
        ? lat
        : (savedSchool?.lat ?? DEFAULT_MAP_CENTER.latitude),
      longitude: hasCoords
        ? lng
        : (savedSchool?.lng ?? DEFAULT_MAP_CENTER.longitude),
      spotId,
    };
  }

  if (!spotId) {
    return null;
  }

  if (hasCoords) {
    return {
      school: null,
      latitude: lat,
      longitude: lng,
      spotId,
    };
  }

  return {
    school: null,
    latitude: DEFAULT_MAP_CENTER.latitude,
    longitude: DEFAULT_MAP_CENTER.longitude,
    spotId,
  };
}

export function schoolToMapParams(school: School): Record<string, string> {
  return {
    lat: school.lat.toString(),
    lng: school.lng.toString(),
    schoolId: school.id,
    schoolName: school.name,
    schoolCity: school.city,
    schoolState: school.state,
    schoolNumSpots: school.numSpots.toString(),
  };
}

export function schoolFromSpot(spot: Spot): School | null {
  if (!spot.schoolId) {
    return null;
  }

  return {
    id: spot.schoolId,
    name: spot.schoolName || 'Campus map',
    lat: spot.latitude,
    lng: spot.longitude,
    city: spot.city,
    state: spot.state,
    numSpots: 0,
  };
}

export function spotToMapParams(spot: Spot): Record<string, string> {
  const params: Record<string, string> = {
    lat: spot.latitude.toString(),
    lng: spot.longitude.toString(),
    spotId: spot.id,
  };

  if (spot.schoolId) {
    params.schoolId = spot.schoolId;
  }
  if (spot.schoolName) {
    params.schoolName = spot.schoolName;
  }
  if (spot.city) {
    params.schoolCity = spot.city;
  }
  if (spot.state) {
    params.schoolState = spot.state;
  }

  return params;
}

export function buildFlyToCampusJavascript(
  latitude: number,
  longitude: number
): string {
  return `if (typeof window.flyToCampus === 'function') { window.flyToCampus(${latitude}, ${longitude}); } true;`;
}

export function buildSetCampusCenterJavascript(
  latitude: number,
  longitude: number
): string {
  return `if (typeof window.setCampusCenter === 'function') { window.setCampusCenter(${latitude}, ${longitude}); } true;`;
}
