import {
  AUTH_REQUEST_TIMEOUT_MS,
  authUserMessage,
  getSupabaseConfig,
  resolveUserId,
} from './spots+api';
import { fetchPublicProfile } from './profile-record';

function readBearerToken(request: Request): string | null {
  const header =
    request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
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
      { error: 'Account removal is not configured.' },
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
    const profile = await fetchPublicProfile(
      config,
      auth.userId,
      controller.signal
    );

    if (!profile) {
      return Response.json(
        { error: 'Could not close that account right now. Try again.' },
        { status: 502 }
      );
    }

    if (typeof profile.username === 'string' && profile.username.length > 0) {
      return Response.json(
        {
          error:
            'This account is already set up. Delete it from Settings or email support@skateu.app.',
        },
        { status: 403 }
      );
    }

    const response = await fetch(
      `${config.url}/auth/v1/admin/users/${auth.userId}`,
      {
        method: 'DELETE',
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ should_soft_delete: false }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      console.error('Underage account delete failed:', response.status);
      return Response.json(
        { error: 'Could not close that account right now. Try again.' },
        { status: 502 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    console.error('Underage account abandon failed:', error);
    return Response.json(
      {
        error: timedOut
          ? 'That took too long. Try again in a sec.'
          : 'Could not close that account right now. Try again.',
      },
      { status: timedOut ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
