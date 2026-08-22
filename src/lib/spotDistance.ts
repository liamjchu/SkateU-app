import type { Spot } from '../types/spot';

const EARTH_RADIUS_M = 6_371_000;
const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

type LatLng = {
  latitude: number;
  longitude: number;
};

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function metersBetween(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function compareDistanceThenId(origin: LatLng) {
  return (a: Spot, b: Spot): number => {
    const delta = metersBetween(origin, a) - metersBetween(origin, b);
    if (delta !== 0) {
      return delta;
    }

    return a.id.localeCompare(b.id);
  };
}

export function sortSpotsByDistanceFrom(spots: Spot[], origin: Spot): Spot[] {
  const originSpot = spots.find((spot) => spot.id === origin.id);
  if (originSpot) {
    const rest = spots.filter((spot) => spot.id !== originSpot.id);
    rest.sort(compareDistanceThenId(originSpot));
    return [originSpot, ...rest];
  }

  return [...spots].sort(compareDistanceThenId(origin));
}

export function formatDistanceFromMeters(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) {
    return '';
  }

  const feet = meters * FEET_PER_METER;
  if (feet < 50) {
    return 'Right here';
  }

  if (feet < 1000) {
    return `~${Math.round(feet / 10) * 10} ft away`;
  }

  const miles = meters / METERS_PER_MILE;
  if (miles < 10) {
    return `~${Math.round(miles * 10) / 10} mi away`;
  }

  return `~${Math.round(miles)} mi away`;
}
