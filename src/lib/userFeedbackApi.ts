import { getApiUrl } from './api';
import { sanitizeErrorMessage } from './userFacingError';
import type { SubmitUserFeedbackInput } from '../types/userFeedback';

const MUTATION_TIMEOUT_MS = 60_000;
const SUBMIT_TIMEOUT_ERROR = 'Sending that timed out. Try again in a sec.';
const SUBMIT_FAILED_ERROR = 'Couldn’t send that right now. Try again in a sec.';

type RNFile = { uri: string; name: string; type: string };

function appendFilePart(form: FormData, field: string, file: RNFile): void {
  form.append(field, file as unknown as Blob);
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const responseWithClone = response as unknown as {
      clone?: () => Response;
    };
    if (typeof responseWithClone.clone === 'function') {
      await responseWithClone.clone().arrayBuffer();
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === 'string' && data.error.length > 0) {
      return sanitizeErrorMessage(data.error, SUBMIT_FAILED_ERROR);
    }
  } catch {
    // Body was not JSON; fall through.
  }

  return SUBMIT_FAILED_ERROR;
}

export function buildUserFeedbackRequest(input: SubmitUserFeedbackInput): {
  body: BodyInit;
  headers: Record<string, string>;
} {
  if (input.screenshot) {
    const form = new FormData();
    form.append('type', input.type);
    form.append('message', input.message);
    if (input.category) {
      form.append('category', input.category);
    }
    if (input.spotId) {
      form.append('spotId', input.spotId);
    }
    if (input.email) {
      form.append('email', input.email);
    }
    if (input.metadata) {
      form.append('metadata', JSON.stringify(input.metadata));
    }
    appendFilePart(form, 'screenshot', {
      uri: input.screenshot.uri,
      name: input.screenshot.fileName ?? 'screenshot.jpg',
      type: input.screenshot.mimeType ?? 'image/jpeg',
    });
    return { body: form, headers: {} };
  }

  return {
    body: JSON.stringify({
      type: input.type,
      category: input.category,
      message: input.message,
      spotId: input.spotId,
      email: input.email,
      metadata: input.metadata,
    }),
    headers: { 'Content-Type': 'application/json' },
  };
}

export async function submitUserFeedback(
  input: SubmitUserFeedbackInput,
  accessToken: string
): Promise<{ id: string }> {
  const request = buildUserFeedbackRequest(input);

  let response: Response;
  try {
    response = await fetchWithTimeout(
      getApiUrl('/api/user-feedback'),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...request.headers,
        },
        body: request.body,
      },
      MUTATION_TIMEOUT_MS
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(SUBMIT_TIMEOUT_ERROR);
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as { id?: string };
  if (typeof data.id !== 'string' || data.id.length === 0) {
    throw new Error(SUBMIT_FAILED_ERROR);
  }

  return { id: data.id };
}
