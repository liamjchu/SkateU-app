import {
  authUserMessage,
  getSupabaseConfig,
  resolveUserId,
} from './spots+api';
import { isExpoPushToken, parseExpoPushPlatform } from '../../lib/expoPush';

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

type TokenBody = {
  token?: unknown;
  platform?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Push notifications are not configured.' },
      { status: 500 }
    );
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  let body: TokenBody = {};
  try {
    const parsed: unknown = await request.json();
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as TokenBody;
    }
  } catch {
    return Response.json({ error: 'The request body is malformed.' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const platform = parseExpoPushPlatform(body.platform);
  if (!isExpoPushToken(token) || !platform) {
    return Response.json({ error: 'The push token is invalid.' }, { status: 400 });
  }

  const query = new URL(`${config.url}/rest/v1/push_tokens`);
  const now = new Date().toISOString();

  try {
    const response = await fetch(query.toString(), {
      method: 'POST',
      headers: {
        ...supabaseHeaders(config),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: user.userId,
        expo_push_token: token,
        platform,
        updated_at: now,
      }),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Saving push token failed:', error);
    return Response.json(
      { error: 'Couldn’t save that push token right now.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Push notifications are not configured.' },
      { status: 500 }
    );
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  const tokenParam = new URL(request.url).searchParams.get('token');
  const token = tokenParam?.trim() ?? '';
  if (!isExpoPushToken(token)) {
    return Response.json({ error: 'The push token is invalid.' }, { status: 400 });
  }

  const query = new URL(`${config.url}/rest/v1/push_tokens`);
  query.searchParams.set('user_id', `eq.${user.userId}`);
  query.searchParams.set('expo_push_token', `eq.${token}`);

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
    console.error('Removing push token failed:', error);
    return Response.json(
      { error: 'Couldn’t remove that push token right now.' },
      { status: 500 }
    );
  }
}
