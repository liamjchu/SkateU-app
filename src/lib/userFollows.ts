type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export type ValidatedFollowUser = {
  userId: string;
};

export type FollowListKind = 'followers' | 'following';

export function validateFollowListParam(
  value: string | null
): ValidationResult<FollowListKind> {
  if (value === 'followers' || value === 'following') {
    return { ok: true, value };
  }

  return { ok: false, message: 'The follow list is invalid.' };
}

export function validateFollowUserBody(
  body: unknown,
  validateUserId: (value: string | null) => ValidationResult<string>
): ValidationResult<ValidatedFollowUser> {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'The request body is malformed.' };
  }

  const record = body as { userId?: unknown };
  const userId = typeof record.userId === 'string' ? record.userId : '';
  const validation = validateUserId(userId);
  if (!validation.ok) {
    return { ok: false, message: 'The user id is invalid.' };
  }

  return { ok: true, value: { userId: validation.value } };
}
