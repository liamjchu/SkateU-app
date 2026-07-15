import fc from 'fast-check';

import {
    ALLOWED_IMAGE_TYPES,
    buildInsertRecord,
    DatabaseSpot,
    DELETE,
    DESCRIPTION_MAX,
    GET,
    mapSpot,
    MAX_IMAGE_BYTES,
    MAX_SCHOOL_ID_LENGTH,
    NAME_MAX,
    PATCH,
    POST,
    SpotImageFile,
    uploadImages,
    ValidatedPostBody,
    validateImageFile,
    validatePatchBody,
    validatePostBody,
    validateSchoolId,
    validateSpotId
} from '../spots+api';

// --- Test helpers -----------------------------------------------------------

type FetchMock = jest.Mock<Promise<Response>, [string | URL | Request, RequestInit?]>;

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function setConfigured(): void {
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret-key';
  process.env.OPENAI_API_KEY = 'test-openai-key';
  delete process.env.SUPABASE_ANON_KEY;
}

function openAIApprovalResponse(): Response {
  return jsonResponse({
    choices: [
      {
        message: {
          content: JSON.stringify({ approved: true, flag: 'NONE', reason: '' }),
        },
      },
    ],
  });
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
      updated_at: fc.date({ noInvalidDate: true }).map((d) => d.toISOString()),
      schools: fc.option(
        fc.record({ name: fc.string(), city: fc.string(), state: fc.string() }),
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
      updated_at: '2024-01-01T00:00:00.000Z',
      schools: { name: 'UT Austin', city: 'Austin', state: 'TX' },
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
          updatedAt: '2024-01-01T00:00:00.000Z',
          schoolName: 'UT Austin',
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
      if (requestUrl.includes('api.openai.com')) {
        return openAIApprovalResponse();
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
      updated_at: '2024-01-01T00:00:00.000Z',
      schools: { name: 'UT Austin', city: 'Austin', state: 'TX' },
      creator: { username: 'skater_jane' },
    };
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const requestUrl = input.toString();
      if (requestUrl.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (requestUrl.includes('api.openai.com')) {
        return openAIApprovalResponse();
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
        global.fetch = jest.fn(async (input) => {
          const url = input.toString();
          if (url.includes('/auth/v1/user')) {
            return jsonResponse({ id: 'user-1' });
          }
          return url.includes('api.openai.com')
            ? openAIApprovalResponse()
            : new Response('insert error', { status: 500 });
        }) as unknown as typeof fetch;
        return POST(
          makePostRequest(validForm(), { Authorization: 'Bearer good' })
        );
      },
      // Success
      () => {
        global.fetch = jest.fn(async (input) => {
          const url = input.toString();
          if (url.includes('/auth/v1/user')) {
            return jsonResponse({ id: 'user-1' });
          }
          if (url.includes('api.openai.com')) {
            return openAIApprovalResponse();
          }
          return jsonResponse(
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
          );
        }) as unknown as typeof fetch;
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

// --- validateSpotId ---------------------------------------------------------

describe('validateSpotId', () => {
  it('accepts iff it matches the pattern and length is 1-64', () => {
    fc.assert(
      fc.property(fc.string(), (value: string) => {
        const expected =
          value.length >= 1 &&
          value.length <= MAX_SCHOOL_ID_LENGTH &&
          /^[A-Za-z0-9_-]+$/.test(value);
        expect(validateSpotId(value).ok).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('rejects null (missing) ids', () => {
    expect(validateSpotId(null).ok).toBe(false);
  });

  it('rejects ids longer than 64 characters', () => {
    expect(validateSpotId('a'.repeat(65)).ok).toBe(false);
  });

  it('accepts a UUID spot id', () => {
    const id = '3f1fe457-ffd2-9cd1-ef3d-231096210000';
    expect(validateSpotId(id)).toEqual({ ok: true, value: id });
  });
});

// --- validatePatchBody ------------------------------------------------------

describe('validatePatchBody', () => {
  it('succeeds iff name, description, and coordinates are all valid; names the offending field otherwise', () => {
    const fieldsArb = fc.record({
      name: fc.string(),
      description: fc.string(),
      latitude: fc.oneof(fc.double({ noNaN: true }).map(String), fc.string()),
      longitude: fc.oneof(fc.double({ noNaN: true }).map(String), fc.string()),
    });

    fc.assert(
      fc.property(fieldsArb, (fields: Record<string, string>) => {
        const name = fields.name.trim();
        const description = fields.description.trim();
        const rawLat = fields.latitude.trim();
        const rawLng = fields.longitude.trim();
        const lat = Number(rawLat);
        const lng = Number(rawLng);

        const nameOk = name.length >= 1 && name.length <= NAME_MAX;
        const descOk =
          description.length >= 1 && description.length <= DESCRIPTION_MAX;
        const latOk =
          rawLat.length > 0 && Number.isFinite(lat) && lat >= -90 && lat <= 90;
        const lngOk =
          rawLng.length > 0 && Number.isFinite(lng) && lng >= -180 && lng <= 180;
        const expected = nameOk && descOk && latOk && lngOk;

        const result = validatePatchBody(fields);
        expect(result.ok).toBe(expected);

        if (!result.ok) {
          if (!nameOk) {
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

  it('does not require a schoolId (location + text only)', () => {
    const result = validatePatchBody({
      name: 'Updated rail',
      description: 'Now with wax',
      latitude: '41.8',
      longitude: '-71.4',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Updated rail',
        description: 'Now with wax',
        latitude: 41.8,
        longitude: -71.4,
      },
    });
  });
});

// --- mapSpot: new fields ----------------------------------------------------

describe('mapSpot new fields', () => {
  it('maps updated_at -> updatedAt and schools.name -> schoolName', () => {
    const row: DatabaseSpot = {
      id: 'spot1',
      school_id: 'school1',
      name: 'Rail',
      description: 'A rail',
      latitude: 10,
      longitude: 20,
      image_urls: [],
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-02-02T00:00:00.000Z',
      schools: { name: 'UT Austin', city: 'Austin', state: 'TX' },
      creator: { username: 'skater_jane' },
    };
    const spot = mapSpot(row);
    expect(spot.updatedAt).toBe('2024-02-02T00:00:00.000Z');
    expect(spot.schoolName).toBe('UT Austin');
  });

  it('defaults schoolName and timestamps to empty string when absent', () => {
    const row = {
      id: 'spot1',
      school_id: 'school1',
      name: 'Rail',
      description: 'A rail',
      latitude: 10,
      longitude: 20,
      image_urls: [],
      created_at: '',
      updated_at: '',
      schools: null,
      creator: null,
    } as unknown as DatabaseSpot;
    const spot = mapSpot(row);
    expect(spot.schoolName).toBe('');
    expect(spot.updatedAt).toBe('');
    expect(spot.creatorUsername).toBeNull();
  });
});

// --- GET /api/spots?mine=1 --------------------------------------------------

describe('GET /api/spots?mine=1', () => {
  it('returns 401 when the Authorization header is absent', async () => {
    setConfigured();
    const response = await GET(
      new Request('https://app.test/api/spots?mine=1')
    );
    expect(response.status).toBe(401);
  });

  it('returns 401 when the token is invalid', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ msg: 'invalid token' }), { status: 401 })
    ) as unknown as typeof fetch;

    const response = await GET(
      new Request('https://app.test/api/spots?mine=1', {
        headers: { Authorization: 'Bearer bad-token' },
      })
    );
    expect(response.status).toBe(401);
  });

  it('returns 200 with the caller-owned mapped spots when authorized', async () => {
    setConfigured();
    const row: DatabaseSpot = {
      id: 'spot1',
      school_id: 'school1',
      name: 'My Rail',
      description: 'Mine',
      latitude: 10,
      longitude: 20,
      image_urls: [],
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      schools: { name: 'UT Austin', city: 'Austin', state: 'TX' },
      creator: { username: 'skater_jane' },
    };
    const fetchMock: FetchMock = jest.fn(async (input) => {
      if (input.toString().includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      return jsonResponse([row]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request('https://app.test/api/spots?mine=1', {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { spots: { id: string }[] };
    expect(body.spots).toHaveLength(1);
    expect(body.spots[0].id).toBe('spot1');

    // The listing must be scoped to the verified user id, never a client value.
    const listingCall = fetchMock.mock.calls.find((call) =>
      call[0].toString().includes('created_by_user_id=eq.')
    );
    expect(listingCall?.[0].toString()).toContain('created_by_user_id=eq.user-1');
  });
});

// --- PATCH /api/spots?id=<id> -----------------------------------------------

describe('PATCH /api/spots', () => {
  function validPatchForm(): FormData {
    const form = new FormData();
    form.append('name', 'Updated rail');
    form.append('description', 'Now with wax');
    form.append('latitude', '41.8');
    form.append('longitude', '-71.4');
    return form;
  }

  function ownedRow(overrides: Partial<DatabaseSpot> = {}): DatabaseSpot {
    return {
      id: 'spot1',
      school_id: 'school1',
      name: 'Updated rail',
      description: 'Now with wax',
      latitude: 41.8,
      longitude: -71.4,
      image_urls: [],
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-02-02T00:00:00.000Z',
      schools: { name: 'UT Austin', city: 'Austin', state: 'TX' },
      creator: { username: 'skater_jane' },
      ...overrides,
    };
  }

  it('returns 401 when the Authorization header is absent', async () => {
    setConfigured();
    const response = await PATCH(
      new Request('https://app.test/api/spots?id=spot1', {
        method: 'PATCH',
        body: validPatchForm(),
      })
    );
    expect(response.status).toBe(401);
  });

  it('returns 400 when the spot id is missing', async () => {
    setConfigured();
    const response = await PATCH(
      new Request('https://app.test/api/spots', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer good-token' },
        body: validPatchForm(),
      })
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 when the body is invalid (empty name)', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      jsonResponse({ id: 'user-1' })
    ) as unknown as typeof fetch;

    const form = new FormData();
    form.append('name', '');
    form.append('description', 'Now with wax');
    form.append('latitude', '41.8');
    form.append('longitude', '-71.4');

    const response = await PATCH(
      new Request('https://app.test/api/spots?id=spot1', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer good-token' },
        body: form,
      })
    );
    expect(response.status).toBe(400);
  });

  it('returns 404 when the spot does not exist', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) =>
      input.toString().includes('/auth/v1/user')
        ? jsonResponse({ id: 'user-1' })
        : jsonResponse([]) // ownership lookup: no rows
    ) as unknown as typeof fetch;

    const response = await PATCH(
      new Request('https://app.test/api/spots?id=spot1', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer good-token' },
        body: validPatchForm(),
      })
    );
    expect(response.status).toBe(404);
  });

  it('returns 403 when the spot belongs to another user', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) =>
      input.toString().includes('/auth/v1/user')
        ? jsonResponse({ id: 'user-1' })
        : jsonResponse([{ created_by_user_id: 'user-2', school_id: 'school1' }])
    ) as unknown as typeof fetch;

    const response = await PATCH(
      new Request('https://app.test/api/spots?id=spot1', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer good-token' },
        body: validPatchForm(),
      })
    );
    expect(response.status).toBe(403);
  });

  it('returns 200 with the updated spot when the caller owns it', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = input.toString();
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('api.openai.com')) {
        return openAIApprovalResponse();
      }
      if (init?.method === 'PATCH') {
        return jsonResponse([ownedRow()]);
      }
      // ownership lookup
      return jsonResponse([{ created_by_user_id: 'user-1', school_id: 'school1' }]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await PATCH(
      new Request('https://app.test/api/spots?id=spot1', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer good-token' },
        body: validPatchForm(),
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { spot: { name: string } };
    expect(body.spot.name).toBe('Updated rail');
  });
});

// --- DELETE /api/spots?id=<id> ----------------------------------------------

describe('DELETE /api/spots', () => {
  it('returns 401 when the Authorization header is absent', async () => {
    setConfigured();
    const response = await DELETE(
      new Request('https://app.test/api/spots?id=spot1', { method: 'DELETE' })
    );
    expect(response.status).toBe(401);
  });

  it('returns 403 when the spot belongs to another user', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) =>
      input.toString().includes('/auth/v1/user')
        ? jsonResponse({ id: 'user-1' })
        : jsonResponse([{ created_by_user_id: 'user-2', school_id: 'school1' }])
    ) as unknown as typeof fetch;

    const response = await DELETE(
      new Request('https://app.test/api/spots?id=spot1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(403);
  });

  it('treats an already-missing spot as a successful delete', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) =>
      input.toString().includes('/auth/v1/user')
        ? jsonResponse({ id: 'user-1' })
        : jsonResponse([]) // ownership lookup: no rows
    ) as unknown as typeof fetch;

    const response = await DELETE(
      new Request('https://app.test/api/spots?id=spot1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('returns success when the caller owns the spot', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = input.toString();
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      // ownership lookup
      return jsonResponse([{ created_by_user_id: 'user-1', school_id: 'school1' }]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await DELETE(
      new Request('https://app.test/api/spots?id=spot1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });

    // The actual DELETE request must have been issued to the REST endpoint.
    const deleteCall = fetchMock.mock.calls.find(
      (call) => call[1]?.method === 'DELETE'
    );
    expect(deleteCall?.[0].toString()).toContain('id=eq.spot1');
  });
});
