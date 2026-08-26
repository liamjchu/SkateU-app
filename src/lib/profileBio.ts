// Shared profile bio rules. The API validates the same constraints
// server-side; the editor uses these so the form can explain itself.

import { prefilterComment } from './commentForm';

export const PROFILE_BIO_MAX = 160;

const COMMENT_SPAM_REASON = 'That reads like spam — try a real comment.';
const BIO_SPAM_REASON = 'That reads like spam — try a real bio.';

export function normalizeProfileBio(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function getProfileBioError(content: string): string | null {
  if (content.trim().length > PROFILE_BIO_MAX) {
    return `That’s a bit long. Keep it to ${PROFILE_BIO_MAX} characters.`;
  }
  return null;
}

export function isProfileBioValid(content: string): boolean {
  return getProfileBioError(content) === null;
}

type BioPrefilterResult = { ok: true } | { ok: false; reason: string };

export function prefilterProfileBio(content: string): BioPrefilterResult {
  const result = prefilterComment(content);
  if (!result.ok && result.reason === COMMENT_SPAM_REASON) {
    return { ok: false, reason: BIO_SPAM_REASON };
  }
  return result;
}
