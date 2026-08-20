import {
  CONTACT_CATEGORY_VALUES,
  SPOT_PROBLEM_CATEGORY_VALUES,
  USER_FEEDBACK_TYPE_VALUES,
  type ContactCategory,
  type ContactCategoryOption,
  type SpotProblemCategory,
  type SpotProblemCategoryOption,
  type UserFeedbackType,
} from '../types/userFeedback';

export const FEEDBACK_MESSAGE_MAX = 2000;
export const SPOT_PROBLEM_DETAILS_MAX = 500;
export const USER_FEEDBACK_PER_DAY = 10;
export const FEEDBACK_EMAIL_MAX = 254;
export const METADATA_VALUE_MAX = 80;

export const CONTACT_CATEGORY_OPTIONS: ContactCategoryOption[] = [
  { value: 'general', label: 'General Question' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'press', label: 'Press / Media' },
  { value: 'business', label: 'Business' },
  { value: 'other', label: 'Other' },
];

export const SPOT_PROBLEM_CATEGORY_OPTIONS: SpotProblemCategoryOption[] = [
  { value: 'incorrect_location', label: 'Incorrect location' },
  { value: 'incorrect_information', label: 'Incorrect information' },
  { value: 'incorrect_photo', label: 'Incorrect photo' },
  { value: 'spot_changed', label: 'Spot has changed' },
  { value: 'other', label: 'Other' },
];

const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> = {
  general: 'General Question',
  feedback: 'Feedback',
  partnership: 'Partnership',
  press: 'Press / Media',
  business: 'Business',
  other: 'Other',
};

const SPOT_PROBLEM_CATEGORY_LABELS: Record<SpotProblemCategory, string> = {
  incorrect_location: 'Incorrect location',
  incorrect_information: 'Incorrect information',
  incorrect_photo: 'Incorrect photo',
  spot_changed: 'Spot has changed',
  other: 'Other',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CLIENT_METADATA_KEYS = [
  'appVersion',
  'buildNumber',
  'platform',
  'osVersion',
  'deviceModel',
  'route',
] as const;

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export type ValidatedUserFeedback = {
  type: UserFeedbackType;
  category: string | null;
  message: string;
  spotId: string | null;
  contactEmail: string | null;
  metadata: Record<string, string>;
};

export function isUserFeedbackType(value: unknown): value is UserFeedbackType {
  return (
    typeof value === 'string' &&
    USER_FEEDBACK_TYPE_VALUES.includes(value as UserFeedbackType)
  );
}

export function isContactCategory(value: unknown): value is ContactCategory {
  return (
    typeof value === 'string' &&
    CONTACT_CATEGORY_VALUES.includes(value as ContactCategory)
  );
}

export function isSpotProblemCategory(
  value: unknown
): value is SpotProblemCategory {
  return (
    typeof value === 'string' &&
    SPOT_PROBLEM_CATEGORY_VALUES.includes(value as SpotProblemCategory)
  );
}

export function contactCategoryLabel(category: ContactCategory): string {
  return CONTACT_CATEGORY_LABELS[category];
}

export function spotProblemCategoryLabel(category: SpotProblemCategory): string {
  return SPOT_PROBLEM_CATEGORY_LABELS[category];
}

export function canAttemptSupportSubmit(submitting: boolean): boolean {
  return submitting !== true;
}

export function getFeedbackEmailError(email: string): string | null {
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return 'Enter an email so we can get back to you.';
  }
  if (trimmed.length > FEEDBACK_EMAIL_MAX || !EMAIL_PATTERN.test(trimmed)) {
    return 'Enter a valid email address.';
  }
  return null;
}

export function getFeedbackMessageError(
  type: UserFeedbackType,
  message: string
): string | null {
  const trimmed = message.trim();
  const max =
    type === 'spot_problem' ? SPOT_PROBLEM_DETAILS_MAX : FEEDBACK_MESSAGE_MAX;

  if (trimmed.length > max) {
    return `That’s a bit long. Keep it to ${max} characters.`;
  }

  if (type !== 'spot_problem' && trimmed.length === 0) {
    if (type === 'bug') {
      return 'Tell us what happened.';
    }
    if (type === 'feature') {
      return 'Tell us your idea.';
    }
    return 'Write a message.';
  }

  return null;
}

export function sanitizeClientMetadata(
  raw: unknown
): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const record = raw as Record<string, unknown>;
  const metadata: Record<string, string> = {};

  for (const key of CLIENT_METADATA_KEYS) {
    const value = record[key];
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      continue;
    }
    metadata[key] = trimmed.slice(0, METADATA_VALUE_MAX);
  }

  return metadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateFeedbackBody(
  body: unknown,
  validateSpotId: (value: string | null) => ValidationResult<string>
): ValidationResult<ValidatedUserFeedback> {
  if (!isRecord(body)) {
    return { ok: false, message: 'The request body is malformed.' };
  }

  if (!isUserFeedbackType(body.type)) {
    return { ok: false, message: 'Choose what you want to send.' };
  }

  const type = body.type;
  const message = typeof body.message === 'string' ? body.message : '';
  const messageError = getFeedbackMessageError(type, message);
  if (messageError) {
    return { ok: false, message: messageError };
  }

  let category: string | null = null;
  if (type === 'contact') {
    if (!isContactCategory(body.category)) {
      return { ok: false, message: 'Choose a category.' };
    }
    category = body.category;
  } else if (type === 'spot_problem') {
    if (!isSpotProblemCategory(body.category)) {
      return { ok: false, message: 'Choose what’s wrong with this spot.' };
    }
    category = body.category;
  }

  let spotId: string | null = null;
  if (type === 'spot_problem') {
    const rawSpotId = typeof body.spotId === 'string' ? body.spotId : null;
    const spotValidation = validateSpotId(rawSpotId);
    if (!spotValidation.ok) {
      return {
        ok: false,
        message: 'This needs a spot. Head back to the map and try again.',
      };
    }
    spotId = spotValidation.value;
  }

  let contactEmail: string | null = null;
  if (typeof body.email === 'string' && body.email.trim().length > 0) {
    const emailError = getFeedbackEmailError(body.email);
    if (emailError) {
      return { ok: false, message: emailError };
    }
    contactEmail = body.email.trim();
  }

  return {
    ok: true,
    value: {
      type,
      category,
      message: message.trim(),
      spotId,
      contactEmail,
      metadata: sanitizeClientMetadata(body.metadata),
    },
  };
}
