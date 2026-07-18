import { createHash, randomUUID } from 'crypto';

import {
    AUTH_REQUEST_TIMEOUT_MS,
    getSupabaseConfig,
    resolveUserId,
} from './spots+api';


export const DELETION_PROOF_TTL_MS = 5 * 60_000;

type JwtAmr = {
  method?: unknown;
  timestamp?: unknown;
};

function readBearerToken(request: Request): string | null {
  const header =
    request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function hasRecentOtpAuthentication(accessToken: string): boolean {
  const encodedPayload = accessToken.split('.')[1];
  if (!encodedPayload) {
    return false;
  }

  try {
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { amr?: unknown };
    const amr = payload.amr;
    const cutoff = Math.floor((Date.now() - DELETION_PROOF_TTL_MS) / 1_000);

    return (
      Array.isArray(amr) &&
      amr.some((entry) => {
        if (!entry || typeof entry !== 'object') {
          return false;
        }

        const { method, timestamp } = entry as JwtAmr;
        return (
          method === 'otp' &&
          typeof timestamp === 'number' &&
          timestamp >= cutoff
        );
      })
    );
  } catch {
    return false;
  }
}

function hashProof(proof: string): string {
  return createHash('sha256').update(proof).digest('hex');
}

export async function POST(request: Request): Promise<Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return Response.json(
      { error: 'Authentication is required to verify account deletion.' },
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

    return Response.json(
      { error: 'A valid session is required to verify account deletion.' },
      { status: 401 }
    );
  }

  if (!hasRecentOtpAuthentication(accessToken)) {
    return Response.json(
      { error: 'Enter a new email verification code before deleting your account.' },
      { status: 403 }
    );
  }

  const proof = randomUUID();
  const expiresAt = new Date(Date.now() + DELETION_PROOF_TTL_MS).toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

  try {
    const url = new URL(`${config.url}/rest/v1/account_deletion_proofs`);
    url.searchParams.set('on_conflict', 'user_id');
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: auth.userId,
        proof_hash: hashProof(proof),
        expires_at: expiresAt,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('Creating account-deletion proof failed:', response.status);
      return Response.json(
        { error: 'Could not verify account deletion right now. Please try again.' },
        { status: 502 }
      );
    }

    return Response.json({ proof, expiresAt });
  } catch (error) {
    const status = error instanceof Error && error.name === 'AbortError' ? 504 : 502;
    console.error('Creating account-deletion proof failed:', error);
    return Response.json(
      { error: 'Could not verify account deletion right now. Please try again.' },
      { status }
    );
  } finally {
    clearTimeout(timeout);
  }
}
