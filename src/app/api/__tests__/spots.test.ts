import fc from 'fast-check';

import {
    ALLOWED_IMAGE_TYPES,
    buildInsertRecord,
    DatabaseSpot,
    DESCRIPTION_MAX,
    GET,
    mapSpot,
    MAX_IMAGE_BYTES,
    MAX_SCHOOL_ID_LENGTH,
    NAME_MAX,
    POST,
    SpotImageFile,
    uploadImages,
    ValidatedPostBody,
    validateImageFile,
    validatePostBody,
    validateSchoolId,
} from '../spots+api';

// --- Test helpers -----------------------------------------------------------

type FetchMock = jest.Mock<Promise<Response>, [string | URL | Request, RequestInit?]>;

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

function makeImageFile(type: string, size: number, bytes = 4): SpotImageFile {
  return {
    type,
    size,
    arrayBuffer: async () => new ArrayBuffer(bytes),
  };
}

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

// --- Property 1 (3.2): schoolId validation ----------------------------------

describe('validateSchoolId', () => {
  // Feature: global-spots, Property 1: schoolId validation accepts valid ids
  // and rejects invalid ones
  // Validates: Requirements 4.2, 4.4, 4.5
  it('accepts iff it matches the pattern and length is 1-64', () => {
    fc.assert(
      fc.property(fc.string(), (value: string) => {
        const expected =
          value.length >= 1 &&
          value.length <= MAX_SCHOOL_ID_LENGTH &&
          /^[A-Za-z0-9_-]+$/.test(value);
        expect(validateSchoolId(value).ok).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('rejects null (missing) ids', () => {
    expect(validateSchoolId(null).ok).toBe(false);
  });

  it('rejects ids longer than 64 characters', () => {
    expect(validateSchoolId('a'.repeat(65)).ok).toBe(false);
  });

  it('accepts a representative valid id', () => {
    const result = validateSchoolId('school_123-ABC');
    expect(result).toEqual({ ok: true, value: 'school_123-ABC' });
  });
});

// --- Property 2 (3.4): row -> Spot mapping ----------------------------------

describe('mapSpot', () => {
  // Feature: global-spots, Property 2: row->Spot mapping populates every
  // required field
  // Validates: Requirements 4.6, 5.7, 8.4
  it('populates every required field with the correct type', () => {
    const rowArb = fc.record({
      id: fc.string({ minLength: 1 }),
      school_id: fc.string({ minLength: 1 }),
      name: fc.string(),
      description: fc.string(),
      latitude: fc.double({ noNaN: true }),
      longitude: fc.double({ noNaN: true }),
      image_urls: fc.array(fc.string()),
      created_at: fc.date({ noInvalidDate: true }).map((d) => d.toISOString()),
      schools: fc.option(
        fc.record({ city: fc.string(), state: fc.string() }),
        { nil: null }
      ),
      creator: fc.option(
        fc.record({ username: fc.option(fc.string(), { nil: null }) }),
        { nil: null }
      ),
    });

    fc.assert(
      fc.property(rowArb, (row: DatabaseSpot) => {
        const spot = mapSpot(row);
        expect(typeof spot.id).toBe('string');
        expect(typeof spot.name).toBe('string');
        expect(typeof spot.description).toBe('string');
        expect(typeof spot.latitude).toBe('number');
        expect(typeof spot.longitude).toBe('number');
        expect(Array.isArray(spot.imageUris)).toBe(true);
        expect(typeof spot.city).toBe('string');
        expect(typeof spot.state).toBe('string');
        expect(spot.schoolId).toBe(row.school_id);
        if (row.schools === null) {
          expect(spot.city).toBe('');
          expect(spot.state).toBe('');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 3 (3.6): POST body validation ---------------------------------

describe('validatePostBody', () => {
  // Feature: global-spots, Property 3: POST body validation enforces required
  // fields, lengths, and coordinate ranges
  // Validates: Requirements 5.2, 5.3, 5.4, 5.5
  it('succeeds iff all field predicates hold and names the offending field otherwise', () => {
    const fieldsArb = fc.record({
      schoolId: fc.string(),
      name: fc.string(),
      description: fc.string(),
      latitude: fc.oneof(
        fc.double({ noNaN: true }).map(String),
        fc.string()
      ),
      longitude: fc.oneof(
        fc.double({ noNaN: true }).map(String),
        fc.string()
      ),
    });

    fc.assert(
      fc.property(fieldsArb, (fields: Record<string, string>) => {
        const schoolId = fields.schoolId.trim();
        const name = fields.name.trim();
        const description = fields.description.trim();
        const rawLat = fields.latitude.trim();
        const rawLng = fields.longitude.trim();
        const lat = Number(rawLat);
        const lng = Number(rawLng);

        const schoolOk = schoolId.length >= 1;
        const nameOk = name.length >= 1 && name.length <= NAME_MAX;
        const descOk = description.length >= 1 && description.length <= DESCRIPTION_MAX;
        const latOk =
          rawLat.length > 0 && Number.isFinite(lat) && lat >= -90 && lat <= 90;
        const lngOk =
          rawLng.length > 0 && Number.isFinite(lng) && lng >= -180 && lng <= 180;
        const expected = schoolOk && nameOk && descOk && latOk && lngOk;

        const result = validatePostBody(fields);
        expect(result.ok).toBe(expected);

        if (!result.ok) {
          if (!schoolOk) {
            expect(result.message).toContain('schoolId');
          } else if (!nameOk) {
            expect(result.message).toContain('name');
          } else if (!descOk) {
            expect(result.message).toContain('description');
          } else if (!latOk) {
            expect(result.message).toContain('latitude');
          } else {
            expect(result.message).toContain('longitude');
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 4 (3.8): server-verified ownership ----------------------------

describe('buildInsertRecord', () => {
  // Feature: global-spots, Property 4: created_by_user_id is always the
  // verified user, never the client value
  // Validates: Requirements 6.5, 6.6
  it('always sets created_by_user_id to the verified id', () => {
    fc.assert(
      fc.property(
        fc.record({
          schoolId: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1, maxLength: NAME_MAX }),
          description: fc.string({ minLength: 1, maxLength: DESCRIPTION_MAX }),
          latitude: fc.double({ min: -90, max: 90, noNaN: true }),
          longitude: fc.double({ min: -180, max: 180, noNaN: true }),
        }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.array(fc.string()),
        (
          body: ValidatedPostBody,
          verifiedUserId: string,
          clientUserId: string,
          imageUrls: string[]
        ) => {
          // Simulate a body that also carries a client-supplied user id field.
          const bodyWithClientId = {
            ...body,
            created_by_user_id: clientUserId,
            userId: clientUserId,
          } as ValidatedPostBody;

          const record = buildInsertRecord(bodyWithClientId, verifiedUserId, imageUrls);
          expect(record.created_by_user_id).toBe(verifiedUserId);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 5 (3.10): image file validation -------------------------------

describe('validateImageFile', () => {
  // Feature: global-spots, Property 5: image file validation
  // Validates: Requirements 7.2
  it('accepts iff size <= 10 MB and content type is allowed', () => {
    const typeArb = fc.oneof(
      fc.constantFrom(...ALLOWED_IMAGE_TYPES),
      fc.string()
    );

    fc.assert(
      fc.property(
        typeArb,
        fc.integer({ min: 0, max: MAX_IMAGE_BYTES * 2 }),
        (type: string, size: number) => {
          const expected =
            size <= MAX_IMAGE_BYTES &&
            (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
          expect(validateImageFile({ type, size }).ok).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 6 (5.2): upload URL ordering ----------------------------------

describe('uploadImages', () => {
  // Feature: global-spots, Property 6: uploaded image URLs preserve selection
  // order
  // Validates: Requirements 7.3
  it('returns one URL per image in the same order', async () => {
    setConfigured();

    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(...ALLOWED_IMAGE_TYPES), {
          minLength: 1,
          maxLength: 10,
        }),
        async (types: string[]) => {
          const requestedKeys: string[] = [];
          const fetchMock: FetchMock = jest.fn(async (input) => {
            const requestUrl = input.toString();
            const key = requestUrl.split('/object/spot-images/')[1];
            requestedKeys.push(key);
            return new Response('', { status: 200 });
          });
          global.fetch = fetchMock as unknown as typeof fetch;

          const files = types.map((type) => makeImageFile(type, 1024));
          const config = { url: 'https://project.supabase.co', apiKey: 'secret' };
          const urls = await uploadImages(config, 'school1', files);

          expect(urls).toHaveLength(files.length);
          // Each returned public URL must reference the object key uploaded at
          // the same position, proving order is preserved.
          urls.forEach((url, index) => {
            const publicKey = url.split('/public/spot-images/')[1];
            expect(publicKey).toBe(requestedKeys[index]);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('throws when an upload fails so no record is inserted', async () => {
    const fetchMock: FetchMock = jest.fn(async (_input: string | URL | Request) => new Response('boom', { status: 500 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const config = { url: 'https://project.supabase.co', apiKey: 'secret' };
    await expect(
      uploadImages(config, 'school1', [makeImageFile('image/png', 1024)])
    ).rejects.toThrow();
  });
});

// --- GET edge cases (4.2) ---------------------------------------------------

describe('GET /api/spots', () => {
  it('returns 200 with an empty collection when no rows match', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (_input: string | URL | Request) => jsonResponse([]));
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request('https://app.test/api/spots?schoolId=school1')
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ spots: [] });
  });

  it('returns 200 with mapped spots when rows match', async () => {
    setConfigured();
    const row: DatabaseSpot = {
      id: 'spot1',
      school_id: 'school1',
      name: 'Rail',
      description: 'A rail',
      latitude: 10,
      longitude: 20,
      image_urls: ['https://img/1.jpg'],
      created_at: '2024-01-01T00:00:00.000Z',
      schools: { city: 'Austin', state: 'TX' },
      creator: { username: 'skater_jane' },
    };
    global.fetch = jest.fn(async () => jsonResponse([row])) as unknown as typeof fetch;

    const response = await GET(
      new Request('https://app.test/api/spots?schoolId=school1')
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      spots: [
        {
          id: 'spot1',
          name: 'Rail',
          description: 'A rail',
          latitude: 10,
          longitude: 20,
          imageUris: ['https://img/1.jpg'],
          city: 'Austin',
          state: 'TX',
          schoolId: 'school1',
          creatorUsername: 'skater_jane',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    });
  });

  it('returns 400 when schoolId is missing', async () => {
    setConfigured();
    const response = await GET(new Request('https://app.test/api/spots'));
    expect(response.status).toBe(400);
  });

  it('returns 400 when schoolId is invalid', async () => {
    setConfigured();
    const response = await GET(
      new Request('https://app.test/api/spots?schoolId=bad%20id')
    );
    expect(response.status).toBe(400);
  });

  it('returns 500 when Supabase is not configured', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;

    const response = await GET(
      new Request('https://app.test/api/spots?schoolId=school1')
    );
    expect(response.status).toBe(500);
  });

  it('returns 500 when the upstream fetch fails', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      new Response('upstream error', { status: 500 })
    ) as unknown as typeof fetch;

    const response = await GET(
      new Request('https://app.test/api/spots?schoolId=school1')
    );
    expect(response.status).toBe(500);
  });
});

// --- POST error paths (5.5) -------------------------------------------------

describe('POST /api/spots', () => {
  function makePostRequest(
    body: BodyInit | null,
    headers: Record<string, string> = {}
  ): Request {
    return new Request('https://app.test/api/spots', {
      method: 'POST',
      headers,
      body,
    });
  }

  function validForm(): FormData {
    const form = new FormData();
    form.append('schoolId', 'school1');
    form.append('name', 'Rail');
    form.append('description', 'A nice rail');
    form.append('latitude', '10');
    form.append('longitude', '20');
    return form;
  }

  it('returns 401 when the Authorization header is absent', async () => {
    setConfigured();
    const response = await POST(makePostRequest(validForm()));
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error.toLowerCase()).toContain('authentication');
  });

  it('returns 401 when the token is invalid', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ msg: 'invalid token' }), { status: 401 })
    ) as unknown as typeof fetch;

    const response = await POST(
      makePostRequest(validForm(), { Authorization: 'Bearer bad-token' })
    );
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error.toLowerCase()).toContain('invalid');
  });

  it('returns 401 when the token is expired', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ msg: 'token is expired' }), { status: 401 })
    ) as unknown as typeof fetch;

    const response = await POST(
      makePostRequest(validForm(), { Authorization: 'Bearer expired-token' })
    );
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error.toLowerCase()).toContain('expired');
  });

  it('returns 400 when the body is malformed', async () => {
    setConfigured();
    // Valid auth, then a non-multipart body that formData() cannot parse.
    global.fetch = jest.fn(async () =>
      jsonResponse({ id: 'user-1' })
    ) as unknown as typeof fetch;

    const response = await POST(
      makePostRequest('not-a-form', {
        Authorization: 'Bearer good-token',
        'Content-Type': 'application/json',
      })
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 when required fields are invalid', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      jsonResponse({ id: 'user-1' })
    ) as unknown as typeof fetch;

    const form = new FormData();
    form.append('schoolId', 'school1');
    form.append('name', '');
    form.append('description', 'A rail');
    form.append('latitude', '10');
    form.append('longitude', '20');

    const response = await POST(
      makePostRequest(form, { Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(400);
  });

  it('returns 500 with no partial spot when the insert fails', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const requestUrl = input.toString();
      if (requestUrl.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      // insert fails
      return new Response('insert error', { status: 500 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      makePostRequest(validForm(), { Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(500);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.spot).toBeUndefined();
  });

  it('returns 201 with the created spot on success', async () => {
    setConfigured();
    const createdRow: DatabaseSpot = {
      id: 'spot1',
      school_id: 'school1',
      name: 'Rail',
      description: 'A nice rail',
      latitude: 10,
      longitude: 20,
      image_urls: [],
      created_at: '2024-01-01T00:00:00.000Z',
      schools: { city: 'Austin', state: 'TX' },
      creator: { username: 'skater_jane' },
    };
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const requestUrl = input.toString();
      if (requestUrl.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      return jsonResponse([createdRow], 201);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      makePostRequest(validForm(), { Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { spot: { id: string } };
    expect(body.spot.id).toBe('spot1');
  });

  it('never includes the service-role key in any response body', async () => {
    setConfigured();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

    const scenarios: Array<() => Promise<Response>> = [
      // Missing auth
      () => POST(makePostRequest(validForm())),
      // Invalid token
      () => {
        global.fetch = jest.fn(async () =>
          new Response('invalid', { status: 401 })
        ) as unknown as typeof fetch;
        return POST(
          makePostRequest(validForm(), { Authorization: 'Bearer bad' })
        );
      },
      // Insert failure
      () => {
        global.fetch = jest.fn(async (input) =>
          input.toString().includes('/auth/v1/user')
            ? jsonResponse({ id: 'user-1' })
            : new Response('insert error', { status: 500 })
        ) as unknown as typeof fetch;
        return POST(
          makePostRequest(validForm(), { Authorization: 'Bearer good' })
        );
      },
      // Success
      () => {
        global.fetch = jest.fn(async (input) =>
          input.toString().includes('/auth/v1/user')
            ? jsonResponse({ id: 'user-1' })
            : jsonResponse(
                [
                  {
                    id: 'spot1',
                    school_id: 'school1',
                    name: 'Rail',
                    description: 'A nice rail',
                    latitude: 10,
                    longitude: 20,
                    image_urls: [],
                    schools: { city: 'Austin', state: 'TX' },
                  },
                ],
                201
              )
        ) as unknown as typeof fetch;
        return POST(
          makePostRequest(validForm(), { Authorization: 'Bearer good' })
        );
      },
    ];

    for (const scenario of scenarios) {
      const response = await scenario();
      const text = await response.text();
      expect(text).not.toContain(serviceKey);
    }
  });
});
