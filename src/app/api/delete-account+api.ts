import { createHash } from 'crypto';

import {
    AUTH_REQUEST_TIMEOUT_MS,
    getSupabaseConfig,
    resolveUserId,
} from './spots+api';

// Permanently deletes the signed-in user's account only after a newly verified
// email OTP issued a short-lived proof. The raw proof is returned once to the
// client, while this endpoint stores and compares only its hash.

function readBearerToken(request: Request): string | null {
  const header =
    request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function readDeletionProof(request: Request): string | null {
  const proof = request.headers.get('X-Delete-Account-Proof');
  return proof && proof.length > 0 ? proof : null;
}

function hashProof(proof: string): string {
  return createHash('sha256').update(proof).digest('hex');
}

type ProofConsumption = 'consumed' | 'invalid' | 'unavailable';

async function consumeDeletionProof(
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
  userId: string,
  proof: string
): Promise<ProofConsumption> {
  try {
    const url = new URL(`${config.url}/rest/v1/account_deletion_proofs`);
    url.searchParams.set('user_id', `eq.${userId}`);
    url.searchParams.set('proof_hash', `eq.${hashProof(proof)}`);
    url.searchParams.set('expires_at', `gt.${new Date().toISOString()}`);

    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
        Prefer: 'return=representation',
      },
    });

    if (!response.ok) {
      console.error('Consuming account-deletion proof failed:', response.status);
      return 'unavailable';
    }

    const consumed = (await response.json()) as { user_id?: string }[];
    return consumed.length === 1 && consumed[0]?.user_id === userId
      ? 'consumed'
      : 'invalid';
  } catch (error) {
    console.error('Consuming account-deletion proof failed:', error);
    return 'unavailable';
  }
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
    if (auth.reason === 'timeout') {
      return Response.json(
        { error: 'Account verification timed out. Please try again.' },
        { status: 503 }
      );
    }

    const message =
      auth.reason === 'expired'
        ? 'The access token is expired.'
        : 'The access token is invalid.';
    return Response.json({ error: message }, { status: 401 });
  }

  const proof = readDeletionProof(request);
  if (!proof) {
    return Response.json(
      { error: 'Email verification is required to delete your account.' },
      { status: 403 }
    );
  }

  const proofConsumption = await consumeDeletionProof(config, auth.userId, proof);
  if (proofConsumption === 'unavailable') {
    return Response.json(
      { error: 'Could not verify account deletion right now. Please try again.' },
      { status: 503 }
    );
  }
  if (proofConsumption === 'invalid') {
    return Response.json(
      { error: 'Your deletion verification has expired. Enter a new code and try again.' },
      { status: 403 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

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
        signal: controller.signal,
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
    const timedOut = error instanceof Error && error.name === 'AbortError';
    console.error('Account deletion failed:', error);
    return Response.json(
      {
        error: timedOut
          ? 'Account deletion timed out. Enter a new code and try again.'
          : 'Could not delete your account right now. Try again.',
      },
      { status: timedOut ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
