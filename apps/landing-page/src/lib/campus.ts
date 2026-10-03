export const MIN_SCHOOL_SEARCH_LENGTH = 2;
export const SCHOOL_SEARCH_LIMIT = 20;
export const ALL_SPOTS_LIMIT = 5000;
export const CAMPUS_MAP_ZOOM = 15.5;
export const CAMPUS_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const SCHOOL_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CampusSchool = {
  id: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  numSpots: number;
};

export type CampusSpot = {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  likeCount: number;
  creatorUsername: string | null;
  schoolName?: string | null;
};

export function isSchoolId(value: string): boolean {
  return SCHOOL_ID_PATTERN.test(value);
}

export function formatPlace(city: string, state: string): string {
  if (city && state) {
    return `${city}, ${state}`;
  }

  return city || state;
}

export function spotCountLabel(count: number): string {
  return count === 1 ? "1 spot" : `${count} spots`;
}

export function readSpotId(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw || !isSchoolId(raw)) {
    return null;
  }

  return raw;
}

export function showsAllSpots(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "all";
}

export function readClientSpots(value: unknown): CampusSpot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const spot = readClientSpot(item);
    return spot ? [spot] : [];
  });
}

export function mapSchoolRow(value: unknown): CampusSchool | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const name = readString(value.name);
  const city = readString(value.city);
  const state = readString(value.state);
  const lat = readCoordinate(value.latitude, -90, 90);
  const lng = readCoordinate(value.longitude, -180, 180);

  if (!id || !isSchoolId(id) || !name || !city || !state || lat === null || lng === null) {
    return null;
  }

  return {
    id,
    name,
    city,
    state,
    lat,
    lng,
    numSpots: readCount(value.numspots),
  };
}

export function mapSpotRow(value: unknown): CampusSpot | null {
  if (!isRecord(value) || !isVisibleStatus(value.status)) {
    return null;
  }

  const id = readString(value.id);
  const name = readString(value.name);
  const latitude = readCoordinate(value.latitude, -90, 90);
  const longitude = readCoordinate(value.longitude, -180, 180);

  if (!id || !isSchoolId(id) || !name || latitude === null || longitude === null) {
    return null;
  }

  return {
    id,
    name,
    description: readText(value.description),
    latitude,
    longitude,
    imageUrl: readImageUrl(value.image_urls),
    likeCount: readCount(value.likes_count),
    creatorUsername: readCreatorUsername(value.creator),
    schoolName: readSchoolName(value.schools),
  };
}

function isVisibleStatus(value: unknown): boolean {
  return value === "active" || value === "under_review";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readCoordinate(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return null;
  }

  return value;
}

function readCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function readImageUrl(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    try {
      const url = new URL(item);

      if (url.protocol === "https:") {
        return url.toString();
      }
    } catch {
      continue;
    }
  }

  return null;
}

function readCreatorUsername(value: unknown): string | null {
  const record = Array.isArray(value) ? value[0] : value;

  if (!isRecord(record)) {
    return null;
  }

  return readString(record.username);
}

function readSchoolName(value: unknown): string | null {
  const record = Array.isArray(value) ? value[0] : value;

  if (!isRecord(record)) {
    return null;
  }

  return readString(record.name);
}

function readClientSpot(value: unknown): CampusSpot | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const name = readString(value.name);
  const latitude = readCoordinate(value.latitude, -90, 90);
  const longitude = readCoordinate(value.longitude, -180, 180);

  if (!id || !isSchoolId(id) || !name || latitude === null || longitude === null) {
    return null;
  }

  return {
    id,
    name,
    description: readText(value.description),
    latitude,
    longitude,
    imageUrl: readImageUrl(typeof value.imageUrl === "string" ? [value.imageUrl] : value.imageUrl),
    likeCount: readCount(value.likeCount),
    creatorUsername: readString(value.creatorUsername),
    schoolName: readString(value.schoolName),
  };
}
