import {
  getProfileBioError,
  normalizeProfileBio,
  prefilterProfileBio,
} from '../../lib/profileBio';
import {
  moderateBio,
  softenBioModerationReason,
} from '../../lib/bioModeration';
import { fetchMergedProfile } from './profile-record';
import { getSupabaseConfig, resolveUserId, authUserMessage } from './spots+api';

function readBearerToken(request: Request): string | null {
  const header =
    request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

async function patchProfileBio(
  config: { url: string; apiKey: string },
  userId: string,
  bio: string | null
): Promise<boolean> {
  const response = await fetch(
    `${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ bio }),
    }
  );

  if (!response.ok) {
    console.error('Moderated profile bio update failed:', response.status);
    return false;
  }

  const rows = (await response.json()) as { id?: string }[];
  return Array.isArray(rows) && rows[0]?.id === userId;
}

export async function POST(request: Request) {
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
      { error: 'Profile bio is not configured.' },
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  const rawBio =
    typeof (body as { bio?: unknown })?.bio === 'string'
      ? (body as { bio: string }).bio
      : null;

  if (rawBio === null) {
    return badRequest('Add a bio or leave it blank to clear it.');
  }

  const lengthError = getProfileBioError(rawBio);
  if (lengthError) {
    return badRequest(lengthError);
  }

  const bio = normalizeProfileBio(rawBio);

  if (bio !== null) {
    const prefilter = prefilterProfileBio(bio);
    if (!prefilter.ok) {
      return Response.json({
        allowed: false,
        reason: prefilter.reason,
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: 'Profile bio moderation is not configured.' },
        { status: 500 }
      );
    }

    try {
      const moderation = await moderateBio(bio);
      if (!moderation.approved) {
        return Response.json({
          allowed: false,
          reason: softenBioModerationReason(
            moderation.flag === 'IRRELEVANT' ? 'IRRELEVANT' : 'INAPPROPRIATE'
          ),
        });
      }
    } catch (error) {
      console.error('Profile bio moderation failed:', error);
      return Response.json(
        { error: 'Content check is paused. Try again in a sec.' },
        { status: 503 }
      );
    }
  }

  const saved = await patchProfileBio(config, auth.userId, bio);
  if (!saved) {
    return Response.json(
      { error: 'Could not save the bio right now. Try again.' },
      { status: 502 }
    );
  }

  const profile = await fetchMergedProfile(config, auth.userId);
  if (!profile || profile.id !== auth.userId) {
    return Response.json(
      { error: 'Could not save the bio right now. Try again.' },
      { status: 502 }
    );
  }

  return Response.json({
    allowed: true,
    reason: '',
    profile,
  });
}
