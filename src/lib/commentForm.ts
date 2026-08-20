// Shared comment text rules. The API validates the same constraints
// server-side; the composer uses these so the form can explain itself.

export const COMMENT_CONTENT_MIN = 1;
export const COMMENT_CONTENT_MAX = 500;
export const COMMENT_PAGE_SIZE = 24;

export function getCommentContentError(content: string): string | null {
  const length = content.trim().length;
  if (length < COMMENT_CONTENT_MIN) {
    return 'Still needs a comment.';
  }
  if (length > COMMENT_CONTENT_MAX) {
    return `That’s a bit long. Keep it to ${COMMENT_CONTENT_MAX} characters.`;
  }
  return null;
}

export function isCommentContentValid(content: string): boolean {
  return getCommentContentError(content) === null;
}

type CommentPrefilterResult = { ok: true } | { ok: false; reason: string };

const BLOCKED_TOKENS = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'porn',
  'nazi',
] as const;

function normalizeForBlocklist(value: string): string {
  return value
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/0/g, 'o')
    .replace(/\$/g, 's')
    .replace(/7/g, 't');
}

function containsSensitiveNumericIdentifier(value: string): boolean {
  const compact = value.replace(/[\s_-]/g, '');
  if (!/^\d+$/.test(compact)) {
    return false;
  }

  return compact.length === 9 || (compact.length >= 13 && compact.length <= 19);
}

function looksLikeRepeatedSpam(value: string): boolean {
  if (/(.)\1{11,}/.test(value)) {
    return true;
  }

  const collapsed = value.replace(/\s/g, '');
  if (collapsed.length < 12) {
    return false;
  }

  const counts = new Map<string, number>();
  for (const character of collapsed.toLowerCase()) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }

  let max = 0;
  for (const count of counts.values()) {
    if (count > max) {
      max = count;
    }
  }

  return max / collapsed.length >= 0.85;
}

function containsBlockedToken(value: string): boolean {
  const normalized = normalizeForBlocklist(value);
  return BLOCKED_TOKENS.some((token) =>
    new RegExp(`(?:^|[^a-z0-9])${token}(?:[^a-z0-9]|$)`).test(normalized)
  );
}

/**
 * Cheap server-side filter run before OpenAI. Rejects obvious PII-looking
 * numbers, repeated-character spam, and a small blocked-token list. Does not
 * replace model moderation.
 */
export function prefilterComment(content: string): CommentPrefilterResult {
  const trimmed = content.trim();

  if (containsSensitiveNumericIdentifier(trimmed)) {
    return {
      ok: false,
      reason: 'Let’s skip anything that looks like personal info.',
    };
  }

  if (looksLikeRepeatedSpam(trimmed)) {
    return {
      ok: false,
      reason: 'That reads like spam — try a real comment.',
    };
  }

  if (containsBlockedToken(trimmed)) {
    return {
      ok: false,
      reason: 'Let’s keep this one school-friendly and try again.',
    };
  }

  return { ok: true };
}
