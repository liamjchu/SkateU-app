type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export type ValidatedBlockUser = {
  userId: string;
};

export function validateBlockUserBody(
  body: unknown,
  validateUserId: (value: string | null) => ValidationResult<string>
): ValidationResult<ValidatedBlockUser> {
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
