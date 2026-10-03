import "server-only";

import {
  ALL_SPOTS_LIMIT,
  mapSchoolRow,
  mapSpotRow,
  MIN_SCHOOL_SEARCH_LENGTH,
  SCHOOL_SEARCH_LIMIT,
  isSchoolId,
  type CampusSchool,
  type CampusSpot,
} from "./campus";

export class CampusDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampusDataError";
  }
}

const VISIBLE_SPOT_STATUSES = "in.(active,under_review)";
const SPOT_SELECT =
  "id,name,description,latitude,longitude,image_urls,likes_count,status,creator:profiles(username),schools(name)";

export async function searchSchools(query: string): Promise<CampusSchool[]> {
  const trimmed = query.trim().slice(0, 80);

  if (trimmed.length < MIN_SCHOOL_SEARCH_LENGTH) {
    return [];
  }

  const body = await postJson("/rest/v1/rpc/search_schools", {
    p_query: trimmed,
    p_types: null,
    p_limit: SCHOOL_SEARCH_LIMIT,
  });

  return mapRows(body, mapSchoolRow);
}

export async function getSchool(id: string): Promise<CampusSchool | null> {
  if (!isSchoolId(id)) {
    return null;
  }

  const rows = mapRows(
    await getJson("/rest/v1/schools", {
      id: `eq.${id}`,
      select: "id,name,city,state,latitude,longitude,numspots",
    }),
    mapSchoolRow
  );

  return rows[0] ?? null;
}

export async function getPopularSchool(): Promise<CampusSchool | null> {
  const rows = mapRows(
    await getJson("/rest/v1/schools", {
      select: "id,name,city,state,latitude,longitude,numspots",
      order: "numspots.desc,id.asc",
      limit: "1",
    }),
    mapSchoolRow
  );

  return rows[0] ?? null;
}

export async function getAllSpots(): Promise<CampusSpot[]> {
  return mapRows(
    await getJson("/rest/v1/spots", {
      status: VISIBLE_SPOT_STATUSES,
      select: SPOT_SELECT,
      order: "name.asc",
      limit: String(ALL_SPOTS_LIMIT),
    }),
    mapSpotRow
  );
}

export async function getSchoolSpots(schoolId: string): Promise<CampusSpot[]> {
  if (!isSchoolId(schoolId)) {
    return [];
  }

  return mapRows(
    await getJson("/rest/v1/spots", {
      school_id: `eq.${schoolId}`,
      status: VISIBLE_SPOT_STATUSES,
      select: SPOT_SELECT,
      order: "name.asc",
    }),
    mapSpotRow
  );
}

function mapRows<T>(body: unknown, mapRow: (value: unknown) => T | null): T[] {
  if (!Array.isArray(body)) {
    throw new CampusDataError("School data could not be read.");
  }

  return body.flatMap((row) => {
    const mapped = mapRow(row);
    return mapped ? [mapped] : [];
  });
}

async function getJson(path: string, params: Record<string, string>): Promise<unknown> {
  const config = requiredConfig();
  const url = new URL(path, config.url);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return readResponse(
    await fetch(url, {
      headers: authHeaders(config.apiKey),
      cache: "no-store",
    })
  );
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const config = requiredConfig();

  return readResponse(
    await fetch(new URL(path, config.url), {
      method: "POST",
      headers: {
        ...authHeaders(config.apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })
  );
}

async function readResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new CampusDataError("School data is unavailable.");
  }

  try {
    return await response.json();
  } catch {
    throw new CampusDataError("School data could not be read.");
  }
}

function requiredConfig(): { url: string; apiKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !apiKey) {
    throw new CampusDataError("School search database is not configured.");
  }

  return { url, apiKey };
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
}
