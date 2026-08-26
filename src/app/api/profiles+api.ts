import { displayableAvatarUrl } from '../../lib/avatarUrl';
import { fetchPublicProfile } from './profile-record';
import {
  fetchFollowStats,
  hasBlockEitherWay,
} from './followGraph';
import { getSupabaseConfig, resolveUserId, validateSpotId } from './spots+api';

type SupabaseConfig = { url: string; apiKey: string };

function readBearerToken(request: Request): string | null {
  const header =
    request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

async function resolveOptionalViewer(
  request: Request,
  config: SupabaseConfig
): Promise<string | null> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return null;
  }

  const auth = await resolveUserId(config, accessToken);
  return auth.ok ? auth.userId : null;
}

export async function GET(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json({ error: 'Profiles are not configured.' }, { status: 500 });
  }

  const userValidation = validateSpotId(
    new URL(request.url).searchParams.get('userId')
  );
  if (!userValidation.ok) {
    return Response.json({ error: 'The user id is invalid.' }, { status: 400 });
  }

  const userId = userValidation.value;

  try {
    const viewerId = await resolveOptionalViewer(request, config);
    if (viewerId && viewerId !== userId) {
      const blocked = await hasBlockEitherWay(config, viewerId, userId);
      if (blocked) {
        return Response.json(
          { error: 'This profile isn’t available.' },
          { status: 403 }
        );
      }
    }

    const profile = await fetchPublicProfile(config, userId);
    if (!profile) {
      return Response.json({ error: 'This profile isn’t available.' }, { status: 404 });
    }

    const stats = await fetchFollowStats(config, userId, viewerId);

    return Response.json({
      profile: {
        id: profile.id,
        username: profile.username ?? null,
        avatarUrl: displayableAvatarUrl(profile.avatar_url),
        bio: profile.bio ?? null,
      },
      followerCount: stats.followerCount,
      followingCount: stats.followingCount,
      isFollowing: stats.isFollowing,
    });
  } catch (error) {
    console.error('Loading profile failed:', error);
    return Response.json(
      { error: 'Couldn’t load that profile right now.' },
      { status: 500 }
    );
  }
}
