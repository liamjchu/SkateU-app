import {
  authUserMessage,
  getSupabaseConfig,
  resolveUserId,
  validateSpotId,
} from './spots+api';

type SupabaseConfig = { url: string; apiKey: string };

function readBearerToken(request: Request): string | null {
  const header =
    request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function authError(reason: 'invalid' | 'expired' | 'timeout'): Response {
  const status = reason === 'timeout' ? 503 : 401;
  return Response.json({ error: authUserMessage(reason) }, { status });
}

function supabaseHeaders(config: SupabaseConfig): HeadersInit {
  return {
    apikey: config.apiKey,
    Authorization: `Bearer ${config.apiKey}`,
  };
}

async function requireUser(
  request: Request,
  config: SupabaseConfig
): Promise<{ userId: string } | Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return Response.json({ error: authUserMessage('missing') }, { status: 401 });
  }

  const auth = await resolveUserId(config, accessToken);
  return auth.ok ? { userId: auth.userId } : authError(auth.reason);
}

function isMissingTable(status: number, body: string): boolean {
  if (status !== 404 && status !== 400) {
    return false;
  }
  return (
    body.includes('PGRST205') ||
    body.includes("'public.user_saved_schools'")
  );
}

function schoolIdsFromRows(rows: unknown): string[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  const ids: string[] = [];
  for (const row of rows) {
    if (
      row !== null &&
      typeof row === 'object' &&
      'school_id' in row &&
      typeof row.school_id === 'string' &&
      row.school_id.length > 0
    ) {
      ids.push(row.school_id);
    }
  }
  return ids;
}

export async function GET(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Saved schools are not configured.' },
      { status: 500 }
    );
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  const query = new URL(`${config.url}/rest/v1/user_saved_schools`);
  query.searchParams.set('user_id', `eq.${user.userId}`);
  query.searchParams.set('select', 'school_id');

  try {
    const response = await fetch(query.toString(), {
      headers: supabaseHeaders(config),
    });
    if (!response.ok) {
      const body = await response.text();
      if (isMissingTable(response.status, body)) {
        return Response.json({ schoolIds: [] });
      }
      throw new Error(body);
    }
    const schoolIds = schoolIdsFromRows(await response.json());
    return Response.json({ schoolIds });
  } catch (error) {
    console.error('Loading saved schools failed:', error);
    return Response.json(
      { error: 'Couldn’t load saved schools right now.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Saved schools are not configured.' },
      { status: 500 }
    );
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  let schoolIdRaw: unknown;
  try {
    const parsed: unknown = await request.json();
    schoolIdRaw =
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      'schoolId' in parsed
        ? (parsed as { schoolId?: unknown }).schoolId
        : undefined;
  } catch {
    return Response.json({ error: 'The request body is malformed.' }, { status: 400 });
  }

  const validation = validateSpotId(
    typeof schoolIdRaw === 'string' ? schoolIdRaw : null
  );
  if (!validation.ok) {
    return Response.json({ error: 'The school id is invalid.' }, { status: 400 });
  }

  const query = new URL(`${config.url}/rest/v1/user_saved_schools`);
  try {
    const response = await fetch(query.toString(), {
      method: 'POST',
      headers: {
        ...supabaseHeaders(config),
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: user.userId,
        school_id: validation.value,
      }),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Saving school failed:', error);
    return Response.json(
      { error: 'Couldn’t save that school right now.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Saved schools are not configured.' },
      { status: 500 }
    );
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  const validation = validateSpotId(
    new URL(request.url).searchParams.get('schoolId')
  );
  if (!validation.ok) {
    return Response.json({ error: 'The school id is invalid.' }, { status: 400 });
  }

  const query = new URL(`${config.url}/rest/v1/user_saved_schools`);
  query.searchParams.set('user_id', `eq.${user.userId}`);
  query.searchParams.set('school_id', `eq.${validation.value}`);

  try {
    const response = await fetch(query.toString(), {
      method: 'DELETE',
      headers: {
        ...supabaseHeaders(config),
        Prefer: 'return=minimal',
      },
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Removing saved school failed:', error);
    return Response.json(
      { error: 'Couldn’t remove that saved school right now.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Saved schools are not configured.' },
      { status: 500 }
    );
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  let schoolIdsRaw: unknown;
  try {
    const parsed: unknown = await request.json();
    schoolIdsRaw =
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      'schoolIds' in parsed
        ? (parsed as { schoolIds?: unknown }).schoolIds
        : undefined;
  } catch {
    return Response.json({ error: 'The request body is malformed.' }, { status: 400 });
  }

  if (!Array.isArray(schoolIdsRaw)) {
    return Response.json({ error: 'The school list is invalid.' }, { status: 400 });
  }

  const schoolIds: string[] = [];
  for (const value of schoolIdsRaw) {
    const validation = validateSpotId(typeof value === 'string' ? value : null);
    if (!validation.ok) {
      return Response.json({ error: 'The school list is invalid.' }, { status: 400 });
    }
    if (!schoolIds.includes(validation.value)) {
      schoolIds.push(validation.value);
    }
  }

  const listQuery = new URL(`${config.url}/rest/v1/user_saved_schools`);
  listQuery.searchParams.set('user_id', `eq.${user.userId}`);
  listQuery.searchParams.set('select', 'school_id');

  try {
    const existingResponse = await fetch(listQuery.toString(), {
      headers: supabaseHeaders(config),
    });
    if (!existingResponse.ok) {
      const body = await existingResponse.text();
      if (isMissingTable(existingResponse.status, body)) {
        return Response.json({ schoolIds });
      }
      throw new Error(body);
    }
    const existing = new Set(schoolIdsFromRows(await existingResponse.json()));
    const desired = new Set(schoolIds);
    const toAdd = schoolIds.filter((id) => !existing.has(id));
    const toRemove = [...existing].filter((id) => !desired.has(id));

    if (toRemove.length > 0) {
      const removeQuery = new URL(`${config.url}/rest/v1/user_saved_schools`);
      removeQuery.searchParams.set('user_id', `eq.${user.userId}`);
      removeQuery.searchParams.set('school_id', `in.(${toRemove.join(',')})`);
      const removeResponse = await fetch(removeQuery.toString(), {
        method: 'DELETE',
        headers: {
          ...supabaseHeaders(config),
          Prefer: 'return=minimal',
        },
      });
      if (!removeResponse.ok) {
        throw new Error(await removeResponse.text());
      }
    }

    if (toAdd.length > 0) {
      const insertQuery = new URL(`${config.url}/rest/v1/user_saved_schools`);
      const insertResponse = await fetch(insertQuery.toString(), {
        method: 'POST',
        headers: {
          ...supabaseHeaders(config),
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates,return=minimal',
        },
        body: JSON.stringify(
          toAdd.map((schoolId) => ({
            user_id: user.userId,
            school_id: schoolId,
          }))
        ),
      });
      if (!insertResponse.ok) {
        throw new Error(await insertResponse.text());
      }
    }

    return Response.json({ schoolIds });
  } catch (error) {
    console.error('Syncing saved schools failed:', error);
    return Response.json(
      { error: 'Couldn’t sync saved schools right now.' },
      { status: 500 }
    );
  }
}
