import { HOME_RAIL_PAGE_SIZE } from '../../../lib/homeFeed';
import { GET, SEARCH_LIMIT } from '../schools+api';

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function setConfigured(): void {
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret-key';
  delete process.env.SUPABASE_ANON_KEY;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type SchoolRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  numspots: number;
  type: 'k12_public' | 'k12_private' | 'higher_ed';
};

function makeSchool(id: string, numspots = 5): SchoolRow {
  return {
    id,
    name: `School ${id}`,
    city: 'Austin',
    state: 'TX',
    latitude: 30,
    longitude: -97,
    numspots,
    type: 'higher_ed',
  };
}

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('GET /api/schools popular pagination', () => {
  it('sorts popular schools by numspots desc with id asc and pages without duplicates or gaps', async () => {
    setConfigured();
    const schools = Array.from({ length: HOME_RAIL_PAGE_SIZE + 2 }, (_, index) =>
      makeSchool(`school-${String(index).padStart(2, '0')}`)
    );

    const fetchMock = jest.fn(async (input: string | URL | Request) => {
      const requestUrl = new URL(String(input));
      if (requestUrl.pathname.endsWith('/rest/v1/spots')) {
        return jsonResponse([]);
      }

      const offset = Number(requestUrl.searchParams.get('offset') ?? '0');
      const limit = Number(
        requestUrl.searchParams.get('limit') ?? HOME_RAIL_PAGE_SIZE
      );
      return jsonResponse(schools.slice(offset, offset + limit));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const firstResponse = await GET(
      new Request('https://app.test/api/schools?popular=1')
    );
    const secondResponse = await GET(
      new Request(
        `https://app.test/api/schools?popular=1&offset=${HOME_RAIL_PAGE_SIZE}`
      )
    );

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);

    const firstBody = (await firstResponse.json()) as {
      schools: Array<{ id: string }>;
    };
    const secondBody = (await secondResponse.json()) as {
      schools: Array<{ id: string }>;
    };

    const firstIds = firstBody.schools.map((school) => school.id);
    const secondIds = secondBody.schools.map((school) => school.id);
    const combinedIds = [...firstIds, ...secondIds];

    expect(firstIds).toHaveLength(HOME_RAIL_PAGE_SIZE);
    expect(secondIds).toEqual(['school-24', 'school-25']);
    expect(new Set(combinedIds).size).toBe(combinedIds.length);
    expect(combinedIds).toEqual(schools.map((school) => school.id));

    const schoolRequests = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .filter((requestUrl) => requestUrl.pathname.endsWith('/rest/v1/schools'));

    expect(schoolRequests).toHaveLength(2);
    expect(schoolRequests[0]?.searchParams.get('order')).toBe(
      'numspots.desc,id.asc'
    );
    expect(schoolRequests[1]?.searchParams.get('order')).toBe(
      'numspots.desc,id.asc'
    );
    expect(schoolRequests[1]?.searchParams.get('offset')).toBe(
      String(HOME_RAIL_PAGE_SIZE)
    );
  });

  it('uses the most-liked spot photo for each school card', async () => {
    setConfigured();
    const fetchMock = jest.fn(async (input: string | URL | Request) => {
      const requestUrl = new URL(String(input));
      if (requestUrl.pathname.endsWith('/rest/v1/spots')) {
        expect(requestUrl.searchParams.get('order')).toBe(
          'likes_count.desc,created_at.desc'
        );
        return jsonResponse([
          {
            school_id: 'school-a',
            image_urls: ['https://cdn.test/popular.jpg'],
          },
          {
            school_id: 'school-a',
            image_urls: ['https://cdn.test/recent.jpg'],
          },
        ]);
      }

      return jsonResponse([makeSchool('school-a')]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request('https://app.test/api/schools?popular=1')
    );
    const body = (await response.json()) as {
      schools: Array<{ id: string; spotImageUrl: string | null }>;
    };

    expect(response.status).toBe(200);
    expect(body.schools[0]).toMatchObject({
      id: 'school-a',
      spotImageUrl: 'https://cdn.test/popular.jpg',
    });
  });
});

describe('GET /api/schools search', () => {
  it('returns empty schools without calling PostgREST when the query is shorter than 2 characters', async () => {
    setConfigured();
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request('https://app.test/api/schools?search=b')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ schools: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts once to search_schools and preserves RPC order', async () => {
    setConfigured();
    const ranked = [
      { ...makeSchool('brown-university', 12), name: 'Brown University' },
      { ...makeSchool('brownsville-elem', 0), name: 'Brownsville Elementary' },
    ];
    let rpcBody: unknown;

    const fetchMock = jest.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const requestUrl = new URL(String(input));
        expect(requestUrl.pathname).toBe('/rest/v1/rpc/search_schools');
        expect(init?.method).toBe('POST');
        rpcBody = init?.body ? JSON.parse(String(init.body)) : null;
        return jsonResponse(ranked);
      }
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request('https://app.test/api/schools?search=brown')
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { schools: Array<{ id: string }> };
    expect(body.schools.map((school) => school.id)).toEqual([
      'brown-university',
      'brownsville-elem',
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rpcBody).toEqual({
      p_query: 'brown',
      p_types: null,
      p_limit: SEARCH_LIMIT,
    });
  });

  it('passes a type filter array to the RPC and omits unknown types', async () => {
    setConfigured();
    let rpcBody: unknown;
    const fetchMock = jest.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        rpcBody = init?.body ? JSON.parse(String(init.body)) : null;
        return jsonResponse([]);
      }
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request(
        'https://app.test/api/schools?search=austin&type=higher_ed,unknown'
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ schools: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rpcBody).toEqual({
      p_query: 'austin',
      p_types: ['higher_ed'],
      p_limit: SEARCH_LIMIT,
    });
  });

  it('returns a generic 500 when PostgREST fails and does not leak the upstream message', async () => {
    setConfigured();
    const sensitiveMessage =
      'permission denied for table public.schools: policy "schools_select" using (auth.role() = \'service_role\') on project.supabase.co';
    const fetchMock = jest.fn(async () =>
      new Response(
        JSON.stringify({
          code: '42501',
          details: 'Failed to apply RLS policy on public.schools',
          hint: 'Check schema cache for search_schools',
          message: sensitiveMessage,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET(
      new Request('https://app.test/api/schools?search=brown')
    );
    const bodyText = await response.text();
    const body = JSON.parse(bodyText) as { error: string };

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Unable to search schools right now.' });
    expect(bodyText).not.toContain(sensitiveMessage);
    expect(bodyText).not.toContain('public.schools');
    expect(bodyText).not.toContain('service_role');
    expect(bodyText).not.toContain('RLS');
    expect(bodyText).not.toContain('schema cache');
    expect(consoleError).toHaveBeenCalled();
  });
});
