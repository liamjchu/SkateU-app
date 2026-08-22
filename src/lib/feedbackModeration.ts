import { imageFileToDataUrl } from './spotModeration';

const OPENAI_URL = 'https://api.openai.com/v1/moderations';
const MODEL = 'omni-moderation-latest';
const MODERATION_TIMEOUT_MS = 10_000;

export const FEEDBACK_SAFETY_REJECT_MESSAGE =
  'That message can’t be sent. Keep it about SkateU and try again.';

/** Obvious sexual content, threats, and graphic violence only — not slang or angry bug reports. */
export const BLOCKED_FEEDBACK_CATEGORIES = [
  'sexual',
  'sexual/minors',
  'harassment/threatening',
  'hate/threatening',
  'violence/graphic',
] as const;

export type FeedbackModerationVerdict =
  | { allowed: true }
  | { allowed: false; message: string };

type ModerationInputPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type ModerationResult = {
  categories?: Record<string, boolean | undefined>;
};

type ModerationResponse = {
  results?: ModerationResult[];
};

export function shouldBlockFeedbackCategories(
  categories: Record<string, boolean | undefined> | null | undefined
): boolean {
  if (!categories) {
    return false;
  }

  return BLOCKED_FEEDBACK_CATEGORIES.some((key) => categories[key] === true);
}

function allow(): FeedbackModerationVerdict {
  return { allowed: true };
}

function block(): FeedbackModerationVerdict {
  return { allowed: false, message: FEEDBACK_SAFETY_REJECT_MESSAGE };
}

/**
 * Low-level inbox filter. Rejects explicit sexual content, threats, and
 * graphic violence. Provider failures fail open so Help still works.
 */
export async function moderateFeedbackSubmission(input: {
  message: string;
  imageDataUrl?: string;
}): Promise<FeedbackModerationVerdict> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return allow();
  }

  const parts: ModerationInputPart[] = [{ type: 'text', text: input.message }];
  if (input.imageDataUrl) {
    parts.push({
      type: 'image_url',
      image_url: { url: input.imageDataUrl },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: parts,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('Help safety filter request failed:', response.status);
      return allow();
    }

    const data = (await response.json()) as ModerationResponse;
    const results = Array.isArray(data.results) ? data.results : [];
    if (
      results.some((result) => shouldBlockFeedbackCategories(result.categories))
    ) {
      return block();
    }

    return allow();
  } catch (error) {
    console.error('Help safety filter failed:', error);
    return allow();
  } finally {
    clearTimeout(timeout);
  }
}

export async function screenshotToModerationDataUrl(file: {
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}): Promise<string> {
  return imageFileToDataUrl(file);
}
