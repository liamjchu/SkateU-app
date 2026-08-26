import {
  avatarStorageKeyFromUrl,
  isSkateUAvatarUrl,
} from '../../lib/avatarUrl';
import {
  moderateAvatarImage,
  softenAvatarModerationReason,
} from '../../lib/avatarModeration';
import {
  IMAGE_SANITIZE_ERROR,
  sanitizeSpotImage,
} from '../../lib/sanitizeImage';
import { createRandomId } from '../../lib/webCrypto';
import { fetchMergedProfile, fetchPublicProfile } from './profile-record';
import {
  ALLOWED_IMAGE_TYPES,
  authUserMessage,
  getSupabaseConfig,
  resolveUserId,
} from './spots+api';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 30_000;
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type SupabaseConfig = { url: string; apiKey: string };

function readBearerToken(request: Request): string | null {
  const header =
    request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function isFilePart(value: FormDataEntryValue): value is File {
  return typeof value !== 'string';
}

function supabaseHeaders(config: SupabaseConfig): HeadersInit {
  return {
    apikey: config.apiKey,
    Authorization: `Bearer ${config.apiKey}`,
  };
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function requireUser(
  request: Request
): Promise<
  | { ok: true; config: SupabaseConfig; userId: string }
  | { ok: false; response: Response }
> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return {
      ok: false,
      response: Response.json(
        { error: authUserMessage('missing') },
        { status: 401 }
      ),
    };
  }

  const config = getSupabaseConfig();
  if (!config) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Profile photo database is not configured.' },
        { status: 500 }
      ),
    };
  }

  const auth = await resolveUserId(config, accessToken);
  if (!auth.ok) {
    return {
      ok: false,
      response: Response.json(
        { error: authUserMessage(auth.reason) },
        { status: auth.reason === 'timeout' ? 503 : 401 }
      ),
    };
  }

  return { ok: true, config, userId: auth.userId };
}

async function deleteAvatarObject(
  config: SupabaseConfig,
  imageUrl: string
): Promise<void> {
  const key = avatarStorageKeyFromUrl(imageUrl);
  if (!key) {
    return;
  }

  const response = await fetch(`${config.url}/storage/v1/object/remove`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(config),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: [key] }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function uploadAvatar(
  config: SupabaseConfig,
  userId: string,
  file: { type: string; arrayBuffer: () => Promise<ArrayBuffer> }
): Promise<string> {
  const extension = IMAGE_EXTENSIONS[file.type] ?? 'bin';
  const objectKey = `${userId}/${createRandomId()}.${extension}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const body = await file.arrayBuffer();
    const response = await fetch(
      `${config.url}/storage/v1/object/avatars/${objectKey}`,
      {
        method: 'POST',
        headers: {
          ...supabaseHeaders(config),
          'Content-Type': file.type,
        },
        body,
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(`Avatar upload failed: ${await response.text()}`);
    }
  } finally {
    clearTimeout(timeout);
  }

  return `${config.url}/storage/v1/object/public/avatars/${objectKey}`;
}

async function patchAvatarUrl(
  config: SupabaseConfig,
  userId: string,
  avatarUrl: string | null
): Promise<void> {
  const response = await fetch(
    `${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(config),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ avatar_url: avatarUrl }),
    }
  );

  if (!response.ok) {
    throw new Error(`Avatar profile update failed: ${response.status}`);
  }
}

async function mergedProfileResponse(
  config: SupabaseConfig,
  userId: string
): Promise<Response> {
  const profile = await fetchMergedProfile(config, userId);
  if (!profile || profile.id !== userId) {
    return Response.json(
      { error: 'Could not save the photo right now. Try again.' },
      { status: 502 }
    );
  }

  return Response.json({ allowed: true, reason: '', profile });
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { config, userId } = auth;

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: 'Photo review is not configured.' },
      { status: 500 }
    );
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

  const file = form.get('image');
  if (!file || !isFilePart(file)) {
    return Response.json(
      { error: 'Choose a photo to use as your profile picture.' },
      { status: 400 }
    );
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return Response.json(
      { error: 'The selected image exceeds the 5 MB file size limit.' },
      { status: 400 }
    );
  }

  if (
    !ALLOWED_IMAGE_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_TYPES)[number]
    )
  ) {
    return Response.json(
      {
        error:
          'The selected image format is unsupported. Use JPEG, PNG, or WEBP.',
      },
      { status: 400 }
    );
  }

  const sanitized = sanitizeSpotImage({
    type: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!sanitized.ok) {
    return Response.json({ error: IMAGE_SANITIZE_ERROR }, { status: 400 });
  }

  const copy = sanitized.bytes.slice();
  const sanitizedFile = {
    type: sanitized.type,
    arrayBuffer: async () => bytesToArrayBuffer(copy),
  };

  let imageUrl: string;
  try {
    imageUrl = await uploadAvatar(config, userId, sanitizedFile);
  } catch (error) {
    console.error('Uploading profile photo failed:', error);
    return Response.json(
      { error: 'Unable to upload the photo right now.' },
      { status: 500 }
    );
  }

  let verdict;
  try {
    verdict = await moderateAvatarImage(imageUrl);
  } catch (error) {
    console.error('Profile photo moderation failed:', error);
    try {
      await deleteAvatarObject(config, imageUrl);
    } catch (cleanupError) {
      console.error('Cleaning up unreviewed avatar failed:', cleanupError);
    }
    return Response.json(
      { error: 'Could not check the photo right now. Try again.' },
      { status: 503 }
    );
  }

  if (!verdict.approved) {
    try {
      await deleteAvatarObject(config, imageUrl);
    } catch (cleanupError) {
      console.error('Cleaning up rejected avatar failed:', cleanupError);
    }
    return Response.json({
      allowed: false,
      reason: softenAvatarModerationReason(verdict.reason),
    });
  }

  let previousUrl: string | null = null;
  try {
    const current = await fetchPublicProfile(config, userId);
    previousUrl = current?.avatar_url ?? null;
    await patchAvatarUrl(config, userId, imageUrl);
  } catch (error) {
    console.error('Saving profile photo failed:', error);
    try {
      await deleteAvatarObject(config, imageUrl);
    } catch (cleanupError) {
      console.error('Cleaning up unsaved avatar failed:', cleanupError);
    }
    return Response.json(
      { error: 'Could not save the photo right now. Try again.' },
      { status: 502 }
    );
  }

  if (previousUrl && previousUrl !== imageUrl && isSkateUAvatarUrl(previousUrl)) {
    try {
      await deleteAvatarObject(config, previousUrl);
    } catch (cleanupError) {
      console.error('Deleting previous avatar failed:', cleanupError);
    }
  }

  return mergedProfileResponse(config, userId);
}

export async function DELETE(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { config, userId } = auth;

  let previousUrl: string | null = null;
  try {
    const current = await fetchPublicProfile(config, userId);
    previousUrl = current?.avatar_url ?? null;
    await patchAvatarUrl(config, userId, null);
  } catch (error) {
    console.error('Removing profile photo failed:', error);
    return Response.json(
      { error: 'Could not remove the photo right now. Try again.' },
      { status: 502 }
    );
  }

  if (previousUrl && isSkateUAvatarUrl(previousUrl)) {
    try {
      await deleteAvatarObject(config, previousUrl);
    } catch (cleanupError) {
      console.error('Deleting removed avatar failed:', cleanupError);
    }
  }

  return mergedProfileResponse(config, userId);
}
