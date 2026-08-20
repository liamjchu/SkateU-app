import {
  AUTH_REQUEST_TIMEOUT_MS,
  authUserMessage,
  getSupabaseConfig,
  resolveUserId,
} from './spots+api';
import { fetchMergedProfile, upsertProfileLegal } from './profile-record';

function readBearerToken(request: Request): string | null {
  const header =
    request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export async function GET(request: Request): Promise<Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return Response.json(
      { error: authUserMessage('missing') },
      { status: 401 }
    );
  }

  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Legal acceptance is not configured.' },
      { status: 500 }
    );
  }

  const auth = await resolveUserId(config, accessToken);
  if (!auth.ok) {
    return Response.json(
      { error: authUserMessage(auth.reason) },
      { status: auth.reason === 'timeout' ? 503 : 401 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

  try {
    const profile = await fetchMergedProfile(config, auth.userId, controller.signal);
    if (!profile || profile.id !== auth.userId) {
      return Response.json(
        { error: 'Could not load your profile right now. Try again.' },
        { status: 502 }
      );
    }

    return Response.json({ profile });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    console.error('Legal profile fetch failed:', error);
    return Response.json(
      {
        error: timedOut
          ? 'That took too long. Try again in a sec.'
          : 'Could not load your profile right now. Try again.',
      },
      { status: timedOut ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request): Promise<Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return Response.json(
      { error: authUserMessage('missing') },
      { status: 401 }
    );
  }

  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Legal acceptance is not configured.' },
      { status: 500 }
    );
  }

  const auth = await resolveUserId(config, accessToken);
  if (!auth.ok) {
    return Response.json(
      { error: authUserMessage(auth.reason) },
      { status: auth.reason === 'timeout' ? 503 : 401 }
    );
  }

  const acceptedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

  try {
    const profile = await upsertProfileLegal(
      config,
      auth.userId,
      acceptedAt,
      controller.signal
    );
    if (!profile || profile.id !== auth.userId) {
      return Response.json(
        { error: 'Could not save your agreement right now. Try again.' },
        { status: 502 }
      );
    }

    return Response.json({ profile });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    console.error('Legal acceptance failed:', error);
    return Response.json(
      {
        error: timedOut
          ? 'That took too long. Try again in a sec.'
          : 'Could not save your agreement right now. Try again.',
      },
      { status: timedOut ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
