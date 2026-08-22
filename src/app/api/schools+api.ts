import { HOME_RAIL_PAGE_SIZE, parseOffset } from '../../lib/homeFeed';
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
  // Present in "popular" responses: a recent spot photo for the school.
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
};

// Returns the most recent spot photo per school, for popular-school cards.
async function fetchLatestSpotImageBySchool(
  config: { url: string; apiKey: string },
  schoolIds: string[]
) {
  const imageBySchoolId = new Map<string, string>();

  if (schoolIds.length === 0) {
    return imageBySchoolId;
  }

  const query = new URL(`${config.url}/rest/v1/spots`);
  query.searchParams.set('select', 'school_id,image_urls');
  query.searchParams.set('school_id', `in.(${schoolIds.join(',')})`);
  query.searchParams.set('order', 'created_at.desc');
  query.searchParams.set('limit', String(SPOT_IMAGE_LOOKUP_LIMIT));

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

    const firstImage = row.image_urls?.find(
      (imageUrl) => typeof imageUrl === 'string' && imageUrl.length > 0
    );

    if (firstImage) {
      imageBySchoolId.set(row.school_id, firstImage);
    }
  });

  return imageBySchoolId;
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

  if (!isPopularRequest && ids.length === 0 && search.length < MIN_SEARCH_LENGTH) {
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
      const imageBySchoolId = await fetchLatestSpotImageBySchool(
        config,
        schools.map((school) => school.id)
      );

      return Response.json({
        schools: schools.map((school) => ({
          ...mapSchool(school),
          spotImageUrl: imageBySchoolId.get(school.id) ?? null,
        })),
      });
    }

    if (ids.length > 0) {
      const schools = await fetchSchoolRows(
        config,
        { id: `in.(${ids.join(',')})` },
        ids.length
      );
      const imageBySchoolId = await fetchLatestSpotImageBySchool(
        config,
        schools.map((school) => school.id)
      );

      return Response.json({
        schools: schools.map((school) => ({
          ...mapSchool(school),
          spotImageUrl: imageBySchoolId.get(school.id) ?? null,
        })),
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
