const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const MODERATION_TIMEOUT_MS = 8_000;

const SYSTEM_PROMPT = `You are a profile-photo moderator for SkateU, a 13+ campus skate-spot app. Decide if a profile picture is safe to display publicly.

Selfies, portraits, group photos, skate photos, campus photos, pets, landscapes, and ordinary profile pictures are allowed.

Reject the photo if it contains, depicts, or clearly hints at:
- Sexual content, nudity, lingerie, sexual poses, or suggestive NSFW material
- Sexual content involving minors, or a sexualized image of anyone who appears under 18
- Hate symbols, slurs rendered as text in the image, or targeted harassment
- Graphic violence, gore, or real injury intended to shock
- Sensitive personal information, including government IDs, passports, driver’s licenses, student IDs, medical records, credit/debit cards, passwords, or private documents. If a document looks like an ID or credential, reject it.

Casual photos with ordinary clothing, skate culture, or mild attitude are allowed. Do not reject a photo just because it is a selfie, low quality, cropped tightly, or unrelated to skating.

When uncertain about sexual content, minors, or identity documents, reject. When uncertain about ordinary portraits, allow.

Respond ONLY with compact JSON: {"approved": boolean, "reason": string}. If approved is false, "reason" must be one short, gentle, casual sentence, like a friend giving a nudge. Do not scold or use words like inappropriate, prohibited, not allowed, rejected, unsafe, or forbidden. Suggest trying a different photo. If approved is true, reason must be an empty string.`;

type OpenAIResponse = {
  choices?: { message?: { content?: string | null } }[];
};

export type AvatarModerationVerdict = {
  approved: boolean;
  reason: string;
};

function moderationFailure(): Error {
  return new Error('Avatar moderation is unavailable.');
}

function parseVerdict(content: string): AvatarModerationVerdict {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw moderationFailure();
  }

  if (!parsed || typeof parsed !== 'object') {
    throw moderationFailure();
  }

  const candidate = parsed as { approved?: unknown; reason?: unknown };

  if (candidate.approved === true) {
    return { approved: true, reason: '' };
  }

  if (candidate.approved !== false) {
    throw moderationFailure();
  }

  const reason = typeof candidate.reason === 'string' ? candidate.reason.trim() : '';
  if (!reason) {
    throw moderationFailure();
  }

  return { approved: false, reason };
}

const HARSH =
  /\b(inappropriate|prohibited|not allowed|rejected|unsafe|forbidden|violat)\b/i;

export function softenAvatarModerationReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length > 0 && trimmed.length <= 160 && !HARSH.test(trimmed)) {
    return trimmed;
  }

  return 'Let’s try a different photo.';
}

export async function moderateAvatarImage(
  imageUrl: string
): Promise<AvatarModerationVerdict> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw moderationFailure();
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
        temperature: 0,
        max_tokens: 120,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Profile photo for public display.' },
              {
                type: 'image_url',
                image_url: { url: imageUrl, detail: 'low' },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('Avatar moderation request failed:', response.status);
      throw moderationFailure();
    }

    const data = (await response.json()) as OpenAIResponse;
    const responseContent = data.choices?.[0]?.message?.content;
    if (!responseContent) {
      throw moderationFailure();
    }

    return parseVerdict(responseContent);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Avatar moderation is unavailable.'
    ) {
      throw error;
    }

    console.error('Avatar moderation failed:', error);
    throw moderationFailure();
  } finally {
    clearTimeout(timeout);
  }
}
