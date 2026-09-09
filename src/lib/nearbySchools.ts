import type { School } from '../types/school';
import { metersBetween } from './spotDistance';

// How many schools the nearby rail shows.
export const NEARBY_SCHOOLS_LIMIT = 12;
// How many rows a single bounding-box query may pull before ranking.
export const NEARBY_CANDIDATE_LIMIT = 500;
// Widening search rings, in miles. The first ring that returns enough schools
// wins, so dense metros stay accurate and rural users still get results.
export const NEARBY_SEARCH_RADII_MI = [5, 25, 100, 400];
// Re-query the API only after the user has moved this far.
export const NEARBY_REFETCH_METERS = 2000;

export const MAX_LATITUDE = 90;
export const MAX_LONGITUDE = 180;

const METERS_PER_MILE = 1609.344;
// One degree of latitude on a 6,371 km sphere, matching metersBetween.
const MILES_PER_LATITUDE_DEGREE = 69.0932;
// Below this cosine the longitude box explodes, so use the full range instead.
const MIN_LATITUDE_COSINE = 0.01;
const COORDINATE_PRECISION = 6;

export type NearbyOrigin = {
  latitude: number;
  longitude: number;
};

export type NearbyBoundingBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * A latitude/longitude box that fully contains the circle of the given radius.
 * Longitude degrees narrow toward the poles, so the longitude span is widened
 * by 1/cos(latitude). Boxes that would cross a pole or the antimeridian fall
 * back to the full longitude range; the haversine ranking still picks the
 * closest schools, the query is just less selective.
 */
export function boundingBoxFor(
  origin: NearbyOrigin,
  radiusMiles: number
): NearbyBoundingBox {
  const latDelta = Math.abs(radiusMiles) / MILES_PER_LATITUDE_DEGREE;
  const minLat = origin.latitude - latDelta;
  const maxLat = origin.latitude + latDelta;
  const cosLatitude = Math.cos(toRadians(origin.latitude));

  const wrapsPole = minLat <= -MAX_LATITUDE || maxLat >= MAX_LATITUDE;
  const lngDelta =
    cosLatitude < MIN_LATITUDE_COSINE
      ? MAX_LONGITUDE
      : Math.min(MAX_LONGITUDE, latDelta / cosLatitude);
  const wrapsAntimeridian =
    origin.longitude - lngDelta < -MAX_LONGITUDE ||
    origin.longitude + lngDelta > MAX_LONGITUDE;

  if (wrapsPole || wrapsAntimeridian) {
    return {
      minLat: clamp(minLat, -MAX_LATITUDE, MAX_LATITUDE),
      maxLat: clamp(maxLat, -MAX_LATITUDE, MAX_LATITUDE),
      minLng: -MAX_LONGITUDE,
      maxLng: MAX_LONGITUDE,
    };
  }

  return {
    minLat,
    maxLat,
    minLng: origin.longitude - lngDelta,
    maxLng: origin.longitude + lngDelta,
  };
}

/**
 * The box as a PostgREST `and=(...)` filter value, so it can travel as a
 * single query param instead of four repeated latitude/longitude keys.
 */
export function boundingBoxFilter(box: NearbyBoundingBox): string {
  const round = (value: number) => value.toFixed(COORDINATE_PRECISION);

  return `(latitude.gte.${round(box.minLat)},latitude.lte.${round(
    box.maxLat
  )},longitude.gte.${round(box.minLng)},longitude.lte.${round(box.maxLng)})`;
}

export function parseCoordinate(
  raw: string | null,
  maxAbsolute: number
): number | null {
  if (raw === null) {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value) || Math.abs(value) > maxAbsolute) {
    return null;
  }

  return value;
}

export function parseNearbyOrigin(
  rawLat: string | null,
  rawLng: string | null
): NearbyOrigin | null {
  const latitude = parseCoordinate(rawLat, MAX_LATITUDE);
  const longitude = parseCoordinate(rawLng, MAX_LONGITUDE);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
}

// Loose enough to accept both the client School type and the API row shape.
type SchoolCoordinates = Pick<School, 'id' | 'lat' | 'lng'>;

export function schoolDistanceMeters(
  origin: NearbyOrigin,
  school: Pick<School, 'lat' | 'lng'>
): number {
  return metersBetween(origin, {
    latitude: school.lat,
    longitude: school.lng,
  });
}

export function milesToMeters(miles: number): number {
  return miles * METERS_PER_MILE;
}

/** Closest first, breaking ties on id so paging and tests stay stable. */
export function sortSchoolsByDistance<T extends SchoolCoordinates>(
  origin: NearbyOrigin,
  schools: T[]
): T[] {
  return schools
    .map((school) => ({
      school,
      distance: schoolDistanceMeters(origin, school),
    }))
    .sort((a, b) => {
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }

      return a.school.id.localeCompare(b.school.id);
    })
    .map((entry) => entry.school);
}

export function shouldRefetchNearby(
  previous: NearbyOrigin | null,
  next: NearbyOrigin
): boolean {
  if (!previous) {
    return true;
  }

  return metersBetween(previous, next) > NEARBY_REFETCH_METERS;
}
