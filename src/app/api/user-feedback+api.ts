import {
  moderateFeedbackSubmission,
  screenshotToModerationDataUrl,
} from '../../lib/feedbackModeration';
import { sendFeedbackEmail } from '../../lib/feedbackNotify';
import { createRandomId } from '../../lib/webCrypto';
import {
  USER_FEEDBACK_PER_DAY,
  validateFeedbackBody,
} from '../../lib/userFeedback';
import {
  authUserMessage,
  getSupabaseConfig,
  isRemovedSpotStatus,
  UPLOAD_TIMEOUT_MS,
  validateImageFile,
  validateSpotId,
  resolveUserId,
} from './spots+api';

type SupabaseConfig = { url: string; apiKey: string };

type FeedbackSpot = {
  id: string;
  name: string;
  status?: string;
};

type DatabaseFeedbackRow = {
  id: string;
  created_at: string;
};

const FEEDBACK_BUCKET = 'feedback-attachments';
const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_ERROR = 'You can only send a few messages each day.';
const SPOT_GONE_ERROR = 'That spot no longer exists.';
const INSERT_SELECT_COLUMNS = 'id,created_at';

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

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

async function requireUser(
  request: Request,
  config: SupabaseConfig
): Promise<{ userId: string; email: string | null } | Response> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return Response.json({ error: authUserMessage('missing') }, { status: 401 });
  }

  const auth = await resolveUserId(config, accessToken);
  return auth.ok
    ? { userId: auth.userId, email: auth.email }
    : authError(auth.reason);
}

function supabaseHeaders(config: SupabaseConfig): HeadersInit {
  return {
    apikey: config.apiKey,
    Authorization: `Bearer ${config.apiKey}`,
  };
}

function isFilePart(value: FormDataEntryValue): value is File {
  return typeof value !== 'string';
}

function readTextField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

function parseMetadataField(raw: string): unknown {
  if (raw.trim().length === 0) {
    return undefined;
  }
  return JSON.parse(raw) as unknown;
}

async function parseRequestBody(
  request: Request
): Promise<{ body: unknown; screenshot: File | null } | Response> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = (await request.formData()) as unknown as FormData;
    } catch {
      return Response.json(
        { error: 'The request body is malformed.' },
        { status: 400 }
      );
    }

    const files = form.getAll('screenshot').filter(isFilePart);
    if (files.length > 1) {
      return Response.json(
        { error: 'Attach at most one screenshot.' },
        { status: 400 }
      );
    }

    let metadata: unknown;
    try {
      metadata = parseMetadataField(readTextField(form, 'metadata'));
    } catch {
      return Response.json(
        { error: 'The metadata field is invalid.' },
        { status: 400 }
      );
    }

    const category = readTextField(form, 'category');
    const email = readTextField(form, 'email');
    const spotId = readTextField(form, 'spotId');

    return {
      body: {
        type: readTextField(form, 'type'),
        category: category.length > 0 ? category : undefined,
        message: readTextField(form, 'message'),
        spotId: spotId.length > 0 ? spotId : undefined,
        email: email.length > 0 ? email : undefined,
        metadata,
      },
      screenshot: files[0] ?? null,
    };
  }

  try {
    const body = (await request.json()) as unknown;
    return { body, screenshot: null };
  } catch {
    return Response.json(
      { error: 'The request body is malformed.' },
      { status: 400 }
    );
  }
}

async function countRecentFeedback(
  config: SupabaseConfig,
  userId: string
): Promise<number> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const query = new URL(`${config.url}/rest/v1/user_feedback`);
  query.searchParams.set('user_id', `eq.${userId}`);
  query.searchParams.set('created_at', `gte.${since}`);
  query.searchParams.set('select', 'id');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as { id: string }[];
  return rows.length;
}

async function fetchUsername(
  config: SupabaseConfig,
  userId: string
): Promise<string | null> {
  const query = new URL(`${config.url}/rest/v1/profiles`);
  query.searchParams.set('id', `eq.${userId}`);
  query.searchParams.set('select', 'username');
  query.searchParams.set('limit', '1');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as { username: string | null }[];
  const username = rows[0]?.username;
  return typeof username === 'string' && username.length > 0 ? username : null;
}

async function fetchFeedbackSpot(
  config: SupabaseConfig,
  spotId: string
): Promise<FeedbackSpot | null> {
  const query = new URL(`${config.url}/rest/v1/spots`);
  query.searchParams.set('id', `eq.${spotId}`);
  query.searchParams.set('select', 'id,name,status');
  query.searchParams.set('limit', '1');

  const response = await fetch(query.toString(), {
    headers: supabaseHeaders(config),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as FeedbackSpot[];
  return rows[0] ?? null;
}

async function uploadFeedbackScreenshot(
  config: SupabaseConfig,
  objectKey: string,
  file: File
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const body = await file.arrayBuffer();
    const response = await fetch(
      `${config.url}/storage/v1/object/${FEEDBACK_BUCKET}/${objectKey}`,
      {
        method: 'POST',
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': file.type,
        },
        body,
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(`Image upload failed: ${await response.text()}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function signFeedbackAttachment(
  config: SupabaseConfig,
  objectKey: string
): Promise<string | null> {
  const response = await fetch(
    `${config.url}/storage/v1/object/sign/${FEEDBACK_BUCKET}/${objectKey}`,
    {
      method: 'POST',
      headers: {
        ...supabaseHeaders(config),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    }
  );

  if (!response.ok) {
    console.error('Signing feedback attachment failed:', await response.text());
    return null;
  }

  const payload = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signedPath = payload.signedURL ?? payload.signedUrl;
  if (typeof signedPath !== 'string' || signedPath.length === 0) {
    return null;
  }

  if (/^https?:\/\//i.test(signedPath)) {
    return signedPath;
  }

  const path = signedPath.startsWith('/') ? signedPath : `/${signedPath}`;
  if (path.startsWith('/storage/v1/')) {
    return `${config.url}${path}`;
  }
  return `${config.url}/storage/v1${path}`;
}

export async function POST(request: Request): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json(
      { error: 'Help & Support is not configured.' },
      { status: 500 }
    );
  }

  const user = await requireUser(request, config);
  if (user instanceof Response) return user;

  const parsed = await parseRequestBody(request);
  if (parsed instanceof Response) return parsed;

  const validation = validateFeedbackBody(parsed.body, validateSpotId);
  if (!validation.ok) {
    return Response.json({ error: validation.message }, { status: 400 });
  }

  const { type, category, message, spotId, contactEmail, metadata } =
    validation.value;

  const resolvedEmail = user.email ?? contactEmail;
  if (!resolvedEmail) {
    return Response.json(
      { error: 'Enter an email so we can get back to you.' },
      { status: 400 }
    );
  }

  if (parsed.screenshot) {
    const imageValidation = validateImageFile({
      type: parsed.screenshot.type,
      size: parsed.screenshot.size,
    });
    if (!imageValidation.ok) {
      return Response.json({ error: imageValidation.message }, { status: 400 });
    }
  }

  try {
    const recentCount = await countRecentFeedback(config, user.userId);
    if (recentCount >= USER_FEEDBACK_PER_DAY) {
      return Response.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    let spotName: string | null = null;
    if (type === 'spot_problem' && spotId) {
      const spot = await fetchFeedbackSpot(config, spotId);
      if (!spot || isRemovedSpotStatus(spot.status)) {
        return Response.json({ error: SPOT_GONE_ERROR }, { status: 404 });
      }
      spotName = spot.name;
    }

    const imageDataUrl = parsed.screenshot
      ? await screenshotToModerationDataUrl(parsed.screenshot)
      : undefined;
    const safety = await moderateFeedbackSubmission({
      message: message.length > 0 ? message : `${type} ${category ?? ''}`.trim(),
      imageDataUrl,
    });
    if (!safety.allowed) {
      return Response.json({ error: safety.message }, { status: 422 });
    }

    const username = await fetchUsername(config, user.userId);
    const id = createRandomId();
    let attachmentPath: string | null = null;

    if (parsed.screenshot) {
      const extension = IMAGE_EXTENSIONS[parsed.screenshot.type] ?? 'bin';
      attachmentPath = `${user.userId}/${id}.${extension}`;
      await uploadFeedbackScreenshot(config, attachmentPath, parsed.screenshot);
    }

    const storedMetadata: Record<string, string> = { ...metadata };
    if (username) {
      storedMetadata.username = username;
    }
    if (spotName) {
      storedMetadata.spotName = spotName;
    }

    const insertUrl = new URL(`${config.url}/rest/v1/user_feedback`);
    insertUrl.searchParams.set('select', INSERT_SELECT_COLUMNS);

    const insertResponse = await fetch(insertUrl.toString(), {
      method: 'POST',
      headers: {
        ...supabaseHeaders(config),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        id,
        user_id: user.userId,
        type,
        category,
        spot_id: spotId,
        message,
        contact_email: resolvedEmail,
        attachment_path: attachmentPath,
        metadata: storedMetadata,
        status: 'new',
      }),
    });

    if (!insertResponse.ok) {
      throw new Error(await insertResponse.text());
    }

    const rows = (await insertResponse.json()) as DatabaseFeedbackRow[];
    const created = rows[0];
    if (!created) {
      throw new Error('Insert returned no representation.');
    }

    let screenshotUrl: string | null = null;
    if (attachmentPath) {
      screenshotUrl = await signFeedbackAttachment(config, attachmentPath);
    }

    try {
      await sendFeedbackEmail({
        id: created.id,
        type,
        category,
        message,
        userId: user.userId,
        username,
        email: resolvedEmail,
        createdAt: created.created_at,
        spotId,
        spotName,
        screenshotUrl,
        metadata: storedMetadata,
      });
    } catch (error) {
      console.error('Sending feedback email failed:', error);
    }

    return Response.json({ id: created.id }, { status: 201 });
  } catch (error) {
    console.error('Creating user feedback failed:', error);
    return Response.json(
      { error: 'Couldn’t send that right now. Try again in a sec.' },
      { status: 500 }
    );
  }
}
