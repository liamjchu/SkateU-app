import { HOME_RAIL_PAGE_SIZE, parseOffset } from '../../lib/homeFeed';
import {
  boundingBoxFilter,
  boundingBoxFor,
  NEARBY_CANDIDATE_LIMIT,
  NEARBY_SCHOOLS_LIMIT,
  NEARBY_SEARCH_RADII_MI,
  parseNearbyOrigin,
  sortSchoolsByDistance,
  type NearbyOrigin,
} from '../../lib/nearbySchools';
import { MIN_SEARCH_LENGTH } from '../../lib/schoolSearch';

type SchoolType = 'k12_public' | 'k12_private' | 'higher_ed';

type DatabaseSchool = {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  numspots: number;
  type: SchoolType;
};

type SchoolSearchResult = {
  id: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  numSpots: number;
  type: SchoolType;
  // Present in "popular" responses: a photo from the school's most-liked public spot.
  spotImageUrl?: string | null;
};

export const SEARCH_LIMIT = 20;
const IDS_LIMIT = 50;
const SPOT_IMAGE_LOOKUP_LIMIT = 200;
const SCHOOL_SELECT_COLUMNS = 'id,name,city,state,latitude,longitude,numspots,type';
const VALID_SCHOOL_TYPES: readonly SchoolType[] = [
  'k12_public',
  'k12_private',
  'higher_ed',
];

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !apiKey) {
    return null;
  }

  return { url, apiKey };
}

function mapSchool(row: DatabaseSchool): SchoolSearchResult {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    state: row.state,
    lat: row.latitude,
    lng: row.longitude,
    numSpots: row.numspots,
    type: row.type,
  };
}

// Parses the `type` query param ("k12_public,higher_ed") into valid types.
// Unknown values are dropped; an empty result means "no type filter".
function parseTypeFilter(rawTypes: string): SchoolType[] {
  return rawTypes
    .split(',')
    .map((type) => type.trim())
    .filter((type): type is SchoolType =>
      VALID_SCHOOL_TYPES.includes(type as SchoolType)
    );
}

async function fetchSchoolRows(
  config: { url: string; apiKey: string },
  searchParams: Record<string, string>,
  limit: number,
  order: string = 'name.asc',
  offset = 0
) {
  const query = new URL(`${config.url}/rest/v1/schools`);
  query.searchParams.set('select', SCHOOL_SELECT_COLUMNS);

  Object.entries(searchParams).forEach(([key, value]) => {
    query.searchParams.set(key, value);
  });

  query.searchParams.set('order', order);
  query.searchParams.set('limit', String(limit));
  if (offset > 0) {
    query.searchParams.set('offset', String(offset));
  }

  const response = await fetch(query.toString(), {
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message);
  }

  return (await response.json()) as DatabaseSchool[];
}

async function searchSchoolRows(
  config: { url: string; apiKey: string },
  query: string,
  types: SchoolType[],
  limit: number
) {
  const response = await fetch(`${config.url}/rest/v1/rpc/search_schools`, {
    method: 'POST',
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_query: query,
      p_types: types.length > 0 ? types : null,
      p_limit: limit,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message);
  }

  return (await response.json()) as DatabaseSchool[];
}

type DatabaseSpotImageRow = {
  school_id: string;
  image_urls: string[] | null;
  status?: string;
};

// Matches spots+api VISIBLE_SPOT_STATUS_FILTER so pending and rejected
// spots never become school-card photos.
const SCHOOL_CARD_SPOT_STATUS_FILTER = 'in.(active,under_review)';
const SCHOOL_CARD_SPOT_ORDER = 'likes_count.desc,comments_count.desc,id.asc';

function isSchoolCardSpotStatus(status: unknown): boolean {
  return status !== 'pending_moderation' && status !== 'removed';
}

// Returns a photo from the most-liked public spot per school, for school cards.
async function fetchPopularSpotImageBySchool(
  config: { url: string; apiKey: string },
  schoolIds: string[]
) {
  const imageBySchoolId = new Map<string, string>();

  if (schoolIds.length === 0) {
    return imageBySchoolId;
  }

  const query = new URL(`${config.url}/rest/v1/spots`);
  query.searchParams.set('select', 'school_id,image_urls,status');
  query.searchParams.set('school_id', `in.(${schoolIds.join(',')})`);
  query.searchParams.set('status', SCHOOL_CARD_SPOT_STATUS_FILTER);
  query.searchParams.set('order', SCHOOL_CARD_SPOT_ORDER);
  query.searchParams.set(
    'limit',
    String(Math.max(SPOT_IMAGE_LOOKUP_LIMIT, schoolIds.length * 25))
  );

  const response = await fetch(query.toString(), {
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message);
  }

  const rows = (await response.json()) as DatabaseSpotImageRow[];

  rows.forEach((row) => {
    if (imageBySchoolId.has(row.school_id)) {
      return;
    }

    if (!isSchoolCardSpotStatus(row.status)) {
      return;
    }

    const firstImage = row.image_urls?.find(
      (imageUrl) => typeof imageUrl === 'string' && imageUrl.length > 0
    );

    if (firstImage) {
      imageBySchoolId.set(row.school_id, firstImage);
    }
  });

  return imageBySchoolId;
}

async function withSpotImages(
  config: { url: string; apiKey: string },
  schools: SchoolSearchResult[]
): Promise<SchoolSearchResult[]> {
  const imageBySchoolId = await fetchPopularSpotImageBySchool(
    config,
    schools.map((school) => school.id)
  );

  return schools.map((school) => ({
    ...school,
    spotImageUrl: imageBySchoolId.get(school.id) ?? null,
  }));
}

// Walks the widening search rings and stops at the first one holding enough
// schools. Rows are ordered by numspots so that when a dense metro overflows
// the candidate limit, the truncated rows are still the useful ones.
async function fetchNearbySchoolRows(
  config: { url: string; apiKey: string },
  origin: NearbyOrigin,
  typeParams: Record<string, string>
) {
  let rows: DatabaseSchool[] = [];

  for (const radiusMiles of NEARBY_SEARCH_RADII_MI) {
    rows = await fetchSchoolRows(
      config,
      {
        and: boundingBoxFilter(boundingBoxFor(origin, radiusMiles)),
        ...typeParams,
      },
      NEARBY_CANDIDATE_LIMIT,
      'numspots.desc,id.asc'
    );

    if (rows.length >= NEARBY_SCHOOLS_LIMIT) {
      break;
    }
  }

  return rows;
}

function parseNearestSchoolRow(value: unknown): DatabaseSchool | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const row = value as Partial<DatabaseSchool>;
  if (
    typeof row.id !== 'string' ||
    row.id.length === 0 ||
    typeof row.name !== 'string' ||
    typeof row.city !== 'string' ||
    typeof row.state !== 'string' ||
    typeof row.latitude !== 'number' ||
    typeof row.longitude !== 'number' ||
    !Number.isFinite(row.latitude) ||
    !Number.isFinite(row.longitude) ||
    typeof row.numspots !== 'number' ||
    !VALID_SCHOOL_TYPES.includes(row.type as SchoolType)
  ) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    city: row.city,
    state: row.state,
    latitude: row.latitude,
    longitude: row.longitude,
    numspots: row.numspots,
    type: row.type as SchoolType,
  };
}

async function fetchNearestSchoolByBoundingBox(
  config: { url: string; apiKey: string },
  origin: NearbyOrigin
): Promise<SchoolSearchResult | null> {
  for (const radiusMiles of NEARBY_SEARCH_RADII_MI) {
    const rows = await fetchSchoolRows(
      config,
      { and: boundingBoxFilter(boundingBoxFor(origin, radiusMiles)) },
      NEARBY_CANDIDATE_LIMIT,
      'id.asc'
    );
    const schools = sortSchoolsByDistance(
      origin,
      rows
        .map(parseNearestSchoolRow)
        .filter((row): row is DatabaseSchool => row !== null)
        .map(mapSchool)
    );
    if (schools[0]) {
      return schools[0];
    }
  }

  return null;
}

export async function fetchNearestSchool(
  config: { url: string; apiKey: string },
  origin: NearbyOrigin
): Promise<SchoolSearchResult | null> {
  const response = await fetch(`${config.url}/rest/v1/rpc/nearest_school`, {
    method: 'POST',
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_lat: origin.latitude,
      p_lng: origin.longitude,
    }),
  });

  if (response.ok) {
    const payload = (await response.json()) as unknown;
    const row = Array.isArray(payload)
      ? parseNearestSchoolRow(payload[0])
      : parseNearestSchoolRow(payload);
    if (row) {
      return mapSchool(row);
    }
  }

  try {
    return await fetchNearestSchoolByBoundingBox(config, origin);
  } catch (error) {
    console.error('Nearest school lookup failed:', error);
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim() ?? '';
  const isPopularRequest = url.searchParams.get('popular') === '1';
  const typeFilter = parseTypeFilter(url.searchParams.get('type') ?? '');
  const typeParams: Record<string, string> =
    typeFilter.length > 0 ? { type: `in.(${typeFilter.join(',')})` } : {};
  const ids = (url.searchParams.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[A-Za-z0-9_-]+$/.test(id))
    .slice(0, IDS_LIMIT);
  // Null when this is not a nearby request, or when the coordinates are
  // missing or out of range; both fall through to the empty response below.
  const nearbyOrigin =
    url.searchParams.get('nearby') === '1'
      ? parseNearbyOrigin(
          url.searchParams.get('lat'),
          url.searchParams.get('lng')
        )
      : null;
  const nearestOrigin =
    url.searchParams.get('nearest') === '1'
      ? parseNearbyOrigin(
          url.searchParams.get('lat'),
          url.searchParams.get('lng')
        )
      : null;

  if (
    !isPopularRequest &&
    nearbyOrigin === null &&
    nearestOrigin === null &&
    ids.length === 0 &&
    search.length < MIN_SEARCH_LENGTH
  ) {
    return Response.json({ schools: [] });
  }

  const config = getSupabaseConfig();

  if (!config) {
    return Response.json(
      { error: 'School search database is not configured.' },
      { status: 500 }
    );
  }

  try {
    if (isPopularRequest) {
      const offset = parseOffset(url.searchParams.get('offset'));
      const schools = await fetchSchoolRows(
        config,
        { numspots: 'gt.0', ...typeParams },
        HOME_RAIL_PAGE_SIZE,
        'numspots.desc,id.asc',
        offset
      );

      return Response.json({
        schools: await withSpotImages(config, schools.map(mapSchool)),
      });
    }

    if (nearestOrigin) {
      const school = await fetchNearestSchool(config, nearestOrigin);
      return Response.json({
        schools: school ? await withSpotImages(config, [school]) : [],
      });
    }

    if (nearbyOrigin) {
      // Schools without spots are kept; the rail is about proximity, and the
      // card falls back to a placeholder when there is no photo.
      const candidates = await fetchNearbySchoolRows(
        config,
        nearbyOrigin,
        typeParams
      );
      const closest = sortSchoolsByDistance(
        nearbyOrigin,
        candidates.map(mapSchool)
      ).slice(0, NEARBY_SCHOOLS_LIMIT);

      return Response.json({
        schools: await withSpotImages(config, closest),
      });
    }

    if (ids.length > 0) {
      const schools = await fetchSchoolRows(
        config,
        { id: `in.(${ids.join(',')})` },
        ids.length
      );

      return Response.json({
        schools: await withSpotImages(config, schools.map(mapSchool)),
      });
    }

    const schools = await searchSchoolRows(
      config,
      search,
      typeFilter,
      SEARCH_LIMIT
    );

    return Response.json({ schools: schools.map(mapSchool) });
  } catch (error) {
    console.error('School search failed:', error);
    return Response.json(
      { error: 'Unable to search schools right now.' },
      { status: 500 }
    );
  }
}
