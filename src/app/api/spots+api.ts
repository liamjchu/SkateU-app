import { randomUUID } from 'crypto';

import type { Spot } from '../../types/spot';

// --- Configuration & constants (mirrors schools+api.ts) ---------------------

type SupabaseConfig = { url: string; apiKey: string };

export const SPOT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
export const MAX_SCHOOL_ID_LENGTH = 64;
export const NAME_MAX = 100;
export const DESCRIPTION_MAX = 1000;
export const MAX_IMAGES = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const UPLOAD_TIMEOUT_MS = 30_000;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const SPOT_SELECT_COLUMNS =
  'id,school_id,name,description,latitude,longitude,image_urls,created_at,updated_at,schools(name,city,state),creator:profiles(username)';

/**
 * Reads Supabase configuration from server-side environment variables only.
 * The service-role key never leaves the server and is never returned in a
 * response body.
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !apiKey) {
    return null;
  }

  return { url, apiKey };
}

type ValidationResult<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * Accepts a schoolId iff it matches ^[A-Za-z0-9_-]+$ and its length is 1–64.
 */
export function validateSchoolId(value: string | null): ValidationResult<string> {
  if (value === null || value.length === 0) {
    return { ok: false, message: 'The schoolId parameter is required.' };
  }

  if (value.length > MAX_SCHOOL_ID_LENGTH || !SPOT_ID_PATTERN.test(value)) {
    return { ok: false, message: 'The schoolId parameter is invalid.' };
  }

  return { ok: true, value };
}

/**
 * Accepts a spot id iff it matches ^[A-Za-z0-9_-]+$ and its length is 1–64.
 * Spot ids are UUIDs, which satisfy this pattern.
 */
export function validateSpotId(value: string | null): ValidationResult<string> {
  if (value === null || value.length === 0) {
    return { ok: false, message: 'The spot id is required.' };
  }

  if (value.length > MAX_SCHOOL_ID_LENGTH || !SPOT_ID_PATTERN.test(value)) {
    return { ok: false, message: 'The spot id is invalid.' };
  }

  return { ok: true, value };
}

// --- Row types & mapping ----------------------------------------------------

export type DatabaseSpot = {
  id: string;
  school_id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  image_urls: string[];
  created_at: string;
  updated_at: string;
  schools: { name: string; city: string; state: string } | null;
  creator: { username: string | null } | null;
};

export type DatabaseSpotInsert = {
  school_id: string;
  created_by_user_id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  image_urls: string[];
};

/**
 * Maps a database row (with the school embed present or absent) to the strict
 * client Spot shape. imageUris is always an array; city/state default to ''.
 */
export function mapSpot(row: DatabaseSpot): Spot {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    latitude: row.latitude,
    longitude: row.longitude,
    imageUris: row.image_urls ?? [],
    city: row.schools?.city ?? '',
    state: row.schools?.state ?? '',
    schoolName: row.schools?.name ?? '',
    schoolId: row.school_id,
    creatorUsername: row.creator?.username ?? null,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

// --- POST body validation ---------------------------------------------------

export type ValidatedPostBody = {
  schoolId: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
};

/**
 * Validates the trimmed text fields of a create-spot request. The first failing
 * field yields a message that names it.
 */
export function validatePostBody(
  fields: Record<string, string>
): ValidationResult<ValidatedPostBody> {
  const schoolId = (fields.schoolId ?? '').trim();
  if (schoolId.length === 0) {
    return { ok: false, message: 'The schoolId field is required.' };
  }

  const name = (fields.name ?? '').trim();
  if (name.length === 0) {
    return { ok: false, message: 'The name field is required.' };
  }
  if (name.length > NAME_MAX) {
    return { ok: false, message: `The name field must be ${NAME_MAX} characters or fewer.` };
  }

  const description = (fields.description ?? '').trim();
  if (description.length === 0) {
    return { ok: false, message: 'The description field is required.' };
  }
  if (description.length > DESCRIPTION_MAX) {
    return {
      ok: false,
      message: `The description field must be ${DESCRIPTION_MAX} characters or fewer.`,
    };
  }

  const rawLatitude = (fields.latitude ?? '').trim();
  if (rawLatitude.length === 0) {
    return { ok: false, message: 'The latitude field is required.' };
  }
  const latitude = Number(rawLatitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, message: 'The latitude coordinate is invalid.' };
  }

  const rawLongitude = (fields.longitude ?? '').trim();
  if (rawLongitude.length === 0) {
    return { ok: false, message: 'The longitude field is required.' };
  }
  const longitude = Number(rawLongitude);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, message: 'The longitude coordinate is invalid.' };
  }

  return {
    ok: true,
    value: { schoolId, name, description, latitude, longitude },
  };
}

/**
 * Builds the insert payload. created_by_user_id is ALWAYS the verified user id,
 * never any client-supplied value.
 */
export function buildInsertRecord(
  body: ValidatedPostBody,
  verifiedUserId: string,
  imageUrls: string[]
): DatabaseSpotInsert {
  return {
    school_id: body.schoolId,
    created_by_user_id: verifiedUserId,
    name: body.name,
    description: body.description,
    latitude: body.latitude,
    longitude: body.longitude,
    image_urls: imageUrls,
  };
}

// --- PATCH body validation --------------------------------------------------

export type ValidatedPatchBody = {
  name: string;
  description: string;
  latitude: number;
  longitude: number;
};

/**
 * Validates the trimmed fields of an edit-spot request. Name, description, and
 * location are editable; the school a spot belongs to is fixed after creation.
 */
export function validatePatchBody(
  fields: Record<string, string>
): ValidationResult<ValidatedPatchBody> {
  const name = (fields.name ?? '').trim();
  if (name.length === 0) {
    return { ok: false, message: 'The name field is required.' };
  }
  if (name.length > NAME_MAX) {
    return { ok: false, message: `The name field must be ${NAME_MAX} characters or fewer.` };
  }

  const description = (fields.description ?? '').trim();
  if (description.length === 0) {
    return { ok: false, message: 'The description field is required.' };
  }
  if (description.length > DESCRIPTION_MAX) {
    return {
      ok: false,
      message: `The description field must be ${DESCRIPTION_MAX} characters or fewer.`,
    };
  }

  const rawLatitude = (fields.latitude ?? '').trim();
  if (rawLatitude.length === 0) {
    return { ok: false, message: 'The latitude field is required.' };
  }
  const latitude = Number(rawLatitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, message: 'The latitude coordinate is invalid.' };
  }

  const rawLongitude = (fields.longitude ?? '').trim();
  if (rawLongitude.length === 0) {
    return { ok: false, message: 'The longitude field is required.' };
  }
  const longitude = Number(rawLongitude);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, message: 'The longitude coordinate is invalid.' };
  }

  return { ok: true, value: { name, description, latitude, longitude } };
}

// --- Image validation & upload ----------------------------------------------

export type SpotImageFile = {
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

/**
 * Accepts an image file descriptor iff size <= 10 MB and its content type is
 * JPEG, PNG, or WEBP.
 */
export function validateImageFile(file: { type: string; size: number }):
  | { ok: true }
  | { ok: false; message: string } {
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: 'The selected image exceeds the 10 MB file size limit.' };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return {
      ok: false,
      message: 'The selected image format is unsupported. Use JPEG, PNG, or WEBP.',
    };
  }

  return { ok: true };
}

/**
 * Uploads each file in selection order to the spot-images bucket using the
 * service-role key, guarded by a per-upload 30s timeout. Returns the public
 * URLs in the same order. Throws on any failure/timeout so no record is
 * inserted.
 */
export async function uploadImages(
  config: SupabaseConfig,
  schoolId: string,
  files: SpotImageFile[]
): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    const extension = IMAGE_EXTENSIONS[file.type] ?? 'bin';
    const objectKey = `${schoolId}/${randomUUID()}.${extension}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
      const body = await file.arrayBuffer();
      const response = await fetch(
        `${config.url}/storage/v1/object/spot-images/${objectKey}`,
        {
          method: 'POST',
          headers: {
            apikey: config.apiKey,
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': file.type,
          },
          body,
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Image upload failed: ${message}`);
      }
    } finally {
      clearTimeout(timeout);
    }

    urls.push(`${config.url}/storage/v1/object/public/spot-images/${objectKey}`);
  }

  return urls;
}

// --- Auth -------------------------------------------------------------------

export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid' | 'expired' };

/**
 * Verifies the bearer token against Supabase auth. Returns the user id on 200,
 * otherwise signals whether the token is invalid or expired for 401 messaging.
 */
export async function resolveUserId(
  config: SupabaseConfig,
  accessToken: string
): Promise<AuthResult> {
  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const user = (await response.json()) as { id?: string };
      if (typeof user.id === 'string' && user.id.length > 0) {
        return { ok: true, userId: user.id };
      }
      return { ok: false, reason: 'invalid' };
    }

    const body = await response.text();
    return { ok: false, reason: /expired/i.test(body) ? 'expired' : 'invalid' };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

// --- Ownership --------------------------------------------------------------

export type SpotOwnership =
  | { found: false }
  | { found: true; ownerId: string | null; schoolId: string };

/**
 * Looks up a spot's owner and school so a write can be authorized before it is
 * applied. The service-role key bypasses RLS, so ownership MUST be checked here
 * against the verified user id — never trust the client for this.
 */
export async function fetchSpotOwnership(
  config: SupabaseConfig,
  spotId: string
): Promise<SpotOwnership> {
  const query = new URL(`${config.url}/rest/v1/spots`);
  query.searchParams.set('id', `eq.${spotId}`);
  query.searchParams.set('select', 'created_by_user_id,school_id');

  const response = await fetch(query.toString(), {
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as {
    created_by_user_id: string | null;
    school_id: string;
  }[];

  if (rows.length === 0) {
    return { found: false };
  }

  return {
    found: true,
    ownerId: rows[0].created_by_user_id,
    schoolId: rows[0].school_id,
  };
}

// --- Request helpers --------------------------------------------------------

function readBearerToken(request: Request): string | null {
  const header =
    request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function readTextField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

function isFilePart(value: FormDataEntryValue): value is File {
  return typeof value !== 'string';
}

// --- GET /api/spots ---------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mineParam = url.searchParams.get('mine');

  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Spots database is not configured.' },
      { status: 500 }
    );
  }

  // `?mine=1` lists every spot the authenticated user created, across schools.
  // It requires a verified token so one user can never read another user's set
  // via a forged id.
  if (mineParam === '1' || mineParam === 'true') {
    return getMySpots(request, config);
  }

  const validation = validateSchoolId(url.searchParams.get('schoolId'));
  if (!validation.ok) {
    return Response.json({ error: validation.message }, { status: 400 });
  }

  try {
    const query = new URL(`${config.url}/rest/v1/spots`);
    query.searchParams.set('school_id', `eq.${validation.value}`);
    query.searchParams.set('select', SPOT_SELECT_COLUMNS);
    query.searchParams.set('order', 'created_at.asc');

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

    const rows = (await response.json()) as DatabaseSpot[];
    return Response.json({ spots: rows.map(mapSpot) });
  } catch (error) {
    console.error('Loading spots failed:', error);
    return Response.json(
      { error: 'Unable to load spots right now.' },
      { status: 500 }
    );
  }
}

/**
 * Lists the authenticated user's own spots (newest first). Ownership is derived
 * from the verified token, never from a client-supplied id.
 */
async function getMySpots(
  request: Request,
  config: SupabaseConfig
): Promise<Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return Response.json(
      { error: 'Authentication is required to load your spots.' },
      { status: 401 }
    );
  }

  const auth = await resolveUserId(config, accessToken);
  if (!auth.ok) {
    const message =
      auth.reason === 'expired'
        ? 'The access token is expired.'
        : 'The access token is invalid.';
    return Response.json({ error: message }, { status: 401 });
  }

  try {
    const query = new URL(`${config.url}/rest/v1/spots`);
    query.searchParams.set('created_by_user_id', `eq.${auth.userId}`);
    query.searchParams.set('select', SPOT_SELECT_COLUMNS);
    query.searchParams.set('order', 'created_at.desc');

    const response = await fetch(query.toString(), {
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const rows = (await response.json()) as DatabaseSpot[];
    return Response.json({ spots: rows.map(mapSpot) });
  } catch (error) {
    console.error('Loading your spots failed:', error);
    return Response.json(
      { error: 'Unable to load your spots right now.' },
      { status: 500 }
    );
  }
}

// --- POST /api/spots --------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return Response.json(
      { error: 'Authentication is required to create a spot.' },
      { status: 401 }
    );
  }

  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Spots database is not configured.' },
      { status: 500 }
    );
  }

  const auth = await resolveUserId(config, accessToken);
  if (!auth.ok) {
    const message =
      auth.reason === 'expired'
        ? 'The access token is expired.'
        : 'The access token is invalid.';
    return Response.json({ error: message }, { status: 401 });
  }

  let form: FormData;
  try {
    // Expo API routes run in a web-standard server runtime where formData()
    // returns a full FormData; the React Native global FormData type used by
    // the bundler omits get/getAll, so bridge through unknown (never `any`).
    form = (await request.formData()) as unknown as FormData;
  } catch {
    return Response.json(
      { error: 'The request body is malformed.' },
      { status: 400 }
    );
  }

  const bodyValidation = validatePostBody({
    schoolId: readTextField(form, 'schoolId'),
    name: readTextField(form, 'name'),
    description: readTextField(form, 'description'),
    latitude: readTextField(form, 'latitude'),
    longitude: readTextField(form, 'longitude'),
  });
  if (!bodyValidation.ok) {
    return Response.json({ error: bodyValidation.message }, { status: 400 });
  }

  const files = form.getAll('image').filter(isFilePart);
  if (files.length > MAX_IMAGES) {
    return Response.json(
      { error: `A spot can have at most ${MAX_IMAGES} images.` },
      { status: 400 }
    );
  }
  for (const file of files) {
    const imageValidation = validateImageFile({ type: file.type, size: file.size });
    if (!imageValidation.ok) {
      return Response.json({ error: imageValidation.message }, { status: 400 });
    }
  }

  let imageUrls: string[];
  try {
    imageUrls = await uploadImages(config, bodyValidation.value.schoolId, files);
  } catch (error) {
    console.error('Uploading spot images failed:', error);
    return Response.json(
      { error: 'Unable to upload the spot images right now.' },
      { status: 500 }
    );
  }

  try {
    const record = buildInsertRecord(bodyValidation.value, auth.userId, imageUrls);
    const insertUrl = new URL(`${config.url}/rest/v1/spots`);
    insertUrl.searchParams.set('select', SPOT_SELECT_COLUMNS);

    const response = await fetch(insertUrl.toString(), {
      method: 'POST',
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message);
    }

    const rows = (await response.json()) as DatabaseSpot[];
    const created = rows[0];
    if (!created) {
      throw new Error('Insert returned no representation.');
    }

    return Response.json({ spot: mapSpot(created) }, { status: 201 });
  } catch (error) {
    console.error('Creating spot failed:', error);
    return Response.json(
      { error: 'Unable to save this spot right now.' },
      { status: 500 }
    );
  }
}

// --- PATCH /api/spots?id=<spotId> -------------------------------------------

export async function PATCH(request: Request): Promise<Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return Response.json(
      { error: 'Authentication is required to edit a spot.' },
      { status: 401 }
    );
  }

  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Spots database is not configured.' },
      { status: 500 }
    );
  }

  const idValidation = validateSpotId(new URL(request.url).searchParams.get('id'));
  if (!idValidation.ok) {
    return Response.json({ error: idValidation.message }, { status: 400 });
  }

  const auth = await resolveUserId(config, accessToken);
  if (!auth.ok) {
    const message =
      auth.reason === 'expired'
        ? 'The access token is expired.'
        : 'The access token is invalid.';
    return Response.json({ error: message }, { status: 401 });
  }

  let form: FormData;
  try {
    form = (await request.formData()) as unknown as FormData;
  } catch {
    return Response.json(
      { error: 'The request body is malformed.' },
      { status: 400 }
    );
  }

  const bodyValidation = validatePatchBody({
    name: readTextField(form, 'name'),
    description: readTextField(form, 'description'),
    latitude: readTextField(form, 'latitude'),
    longitude: readTextField(form, 'longitude'),
  });
  if (!bodyValidation.ok) {
    return Response.json({ error: bodyValidation.message }, { status: 400 });
  }

  // Authorize the write: the spot must exist and be owned by this user.
  let ownership: SpotOwnership;
  try {
    ownership = await fetchSpotOwnership(config, idValidation.value);
  } catch (error) {
    console.error('Loading spot ownership failed:', error);
    return Response.json(
      { error: 'Unable to update this spot right now.' },
      { status: 500 }
    );
  }

  if (!ownership.found) {
    return Response.json({ error: 'That spot no longer exists.' }, { status: 404 });
  }
  if (ownership.ownerId !== auth.userId) {
    return Response.json(
      { error: 'You can only edit spots you created.' },
      { status: 403 }
    );
  }

  // A new image is optional. When present, upload it and replace image_urls;
  // otherwise the existing image is left untouched.
  const files = form.getAll('image').filter(isFilePart);
  if (files.length > MAX_IMAGES) {
    return Response.json(
      { error: `A spot can have at most ${MAX_IMAGES} images.` },
      { status: 400 }
    );
  }
  for (const file of files) {
    const imageValidation = validateImageFile({ type: file.type, size: file.size });
    if (!imageValidation.ok) {
      return Response.json({ error: imageValidation.message }, { status: 400 });
    }
  }

  const updates: {
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    image_urls?: string[];
  } = {
    name: bodyValidation.value.name,
    description: bodyValidation.value.description,
    latitude: bodyValidation.value.latitude,
    longitude: bodyValidation.value.longitude,
  };

  if (files.length > 0) {
    try {
      updates.image_urls = await uploadImages(config, ownership.schoolId, files);
    } catch (error) {
      console.error('Uploading spot images failed:', error);
      return Response.json(
        { error: 'Unable to upload the spot images right now.' },
        { status: 500 }
      );
    }
  }

  try {
    const updateUrl = new URL(`${config.url}/rest/v1/spots`);
    updateUrl.searchParams.set('id', `eq.${idValidation.value}`);
    updateUrl.searchParams.set('select', SPOT_SELECT_COLUMNS);

    const response = await fetch(updateUrl.toString(), {
      method: 'PATCH',
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const rows = (await response.json()) as DatabaseSpot[];
    const updated = rows[0];
    if (!updated) {
      throw new Error('Update returned no representation.');
    }

    return Response.json({ spot: mapSpot(updated) });
  } catch (error) {
    console.error('Updating spot failed:', error);
    return Response.json(
      { error: 'Unable to update this spot right now.' },
      { status: 500 }
    );
  }
}

// --- DELETE /api/spots?id=<spotId> ------------------------------------------

export async function DELETE(request: Request): Promise<Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return Response.json(
      { error: 'Authentication is required to delete a spot.' },
      { status: 401 }
    );
  }

  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Spots database is not configured.' },
      { status: 500 }
    );
  }

  const idValidation = validateSpotId(new URL(request.url).searchParams.get('id'));
  if (!idValidation.ok) {
    return Response.json({ error: idValidation.message }, { status: 400 });
  }

  const auth = await resolveUserId(config, accessToken);
  if (!auth.ok) {
    const message =
      auth.reason === 'expired'
        ? 'The access token is expired.'
        : 'The access token is invalid.';
    return Response.json({ error: message }, { status: 401 });
  }

  // Authorize the delete: the spot must exist and be owned by this user.
  let ownership: SpotOwnership;
  try {
    ownership = await fetchSpotOwnership(config, idValidation.value);
  } catch (error) {
    console.error('Loading spot ownership failed:', error);
    return Response.json(
      { error: 'Unable to delete this spot right now.' },
      { status: 500 }
    );
  }

  if (!ownership.found) {
    // Already gone — treat as success so the client can drop it locally.
    return Response.json({ success: true });
  }
  if (ownership.ownerId !== auth.userId) {
    return Response.json(
      { error: 'You can only delete spots you created.' },
      { status: 403 }
    );
  }

  try {
    const deleteUrl = new URL(`${config.url}/rest/v1/spots`);
    deleteUrl.searchParams.set('id', `eq.${idValidation.value}`);

    const response = await fetch(deleteUrl.toString(), {
      method: 'DELETE',
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Deleting spot failed:', error);
    return Response.json(
      { error: 'Unable to delete this spot right now.' },
      { status: 500 }
    );
  }
}
