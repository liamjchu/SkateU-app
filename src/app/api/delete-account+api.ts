import { getSupabaseConfig, resolveUserId } from './spots+api';

// Permanently deletes the signed-in user's account.
//
// Client flow: the profile screen shows a destructive confirmation, then an
// email OTP re-verification (see authStore.sendDeleteAccountOtp /
// verifyDeleteAccountOtp) before this endpoint is ever called. By the time we
// get here, the caller has already proven they control the account within
// the last few minutes (a fresh OTP verification just re-signed them in).
//
// Deleting `auth.users` cascades to `public.profiles` (profiles.id references
// auth.users.id on delete cascade — see supabase/profiles_setup.sql). Spots
// are intentionally NOT deleted: `spots.created_by_user_id` has ON DELETE SET
// NULL foreign keys to both auth.users and public.profiles (see
// supabase/spots_setup.sql and supabase/spots_creator_link.sql), so a user's
// spots survive with their ownership cleared.

function readBearerToken(request: Request): string | null {
  const header =
    request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export async function DELETE(request: Request): Promise<Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return Response.json(
      { error: 'Authentication is required to delete your account.' },
      { status: 401 }
    );
  }

  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Account deletion is not configured.' },
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

  try {
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
      }
    );

    if (!response.ok) {
      console.error('Admin delete user failed:', response.status, await response.text());
      return Response.json(
        { error: 'Could not delete your account right now. Try again.' },
        { status: 502 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Account deletion failed:', error);
    return Response.json(
      { error: 'Could not delete your account right now. Try again.' },
      { status: 502 }
    );
  }
}
