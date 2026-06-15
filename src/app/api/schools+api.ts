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
};

const SEARCH_LIMIT = 20;
const MIN_SEARCH_LENGTH = 2;
const IDS_LIMIT = 50;
const SCHOOL_SELECT_COLUMNS = 'id,name,city,state,latitude,longitude,numspots,type';

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !apiKey) {
    return null;
  }

  return { url, apiKey };
}

function escapeLikeSearch(search: string) {
  return search.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('*', '\\*');
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

function mergeSchoolRows(schoolGroups: DatabaseSchool[][]) {
  const schoolMap = new Map<string, DatabaseSchool>();

  schoolGroups.flat().forEach((school) => {
    schoolMap.set(school.id, school);
  });

  return Array.from(schoolMap.values())
    .sort((firstSchool, secondSchool) =>
      firstSchool.name.localeCompare(secondSchool.name)
    )
    .slice(0, SEARCH_LIMIT);
}

async function fetchSchoolRows(
  config: { url: string; apiKey: string },
  searchParams: Record<string, string>,
  limit: number
) {
  const query = new URL(`${config.url}/rest/v1/schools`);
  query.searchParams.set('select', SCHOOL_SELECT_COLUMNS);

  Object.entries(searchParams).forEach(([key, value]) => {
    query.searchParams.set(key, value);
  });

  query.searchParams.set('order', 'name.asc');
  query.searchParams.set('limit', String(limit));

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim() ?? '';
  const ids = (url.searchParams.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[A-Za-z0-9_-]+$/.test(id))
    .slice(0, IDS_LIMIT);

  if (ids.length === 0 && search.length < MIN_SEARCH_LENGTH) {
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
    if (ids.length > 0) {
      const schools = await fetchSchoolRows(
        config,
        { id: `in.(${ids.join(',')})` },
        ids.length
      );

      return Response.json({ schools: schools.map(mapSchool) });
    }

    const escapedSearch = escapeLikeSearch(search);
    const [schoolsByName, schoolsByCity, schoolsByState] = await Promise.all([
      fetchSchoolRows(
        config,
        { name: `ilike.*${escapedSearch}*`, type: 'eq.higher_ed' },
        SEARCH_LIMIT
      ),
      fetchSchoolRows(
        config,
        { city: `ilike.*${escapedSearch}*`, type: 'eq.higher_ed' },
        SEARCH_LIMIT
      ),
      fetchSchoolRows(
        config,
        { state: `ilike.*${escapedSearch}*`, type: 'eq.higher_ed' },
        SEARCH_LIMIT
      ),
    ]);
    const schools = mergeSchoolRows([
      schoolsByName,
      schoolsByCity,
      schoolsByState,
    ]);

    return Response.json({ schools: schools.map(mapSchool) });
  } catch (error) {
    console.error('School search failed:', error);
    return Response.json(
      {
        error: `Unable to search schools right now${
          error instanceof Error ? `: ${error.message}` : '.'
        }`,
      },
      { status: 500 }
    );
  }
}
