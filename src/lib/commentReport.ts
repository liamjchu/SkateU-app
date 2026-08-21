import {
  COMMENT_REPORT_REASON_VALUES,
  type CommentReportReason,
  type CommentReportReasonOption,
} from '../types/commentReport';

export const COMMENT_REPORT_DETAILS_MAX = 500;
export const COMMENT_REPORTS_PER_DAY = 20;

export const COMMENT_REPORT_REASON_OPTIONS: CommentReportReasonOption[] = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate or slurs' },
  { value: 'sexual', label: 'Sexual or graphic' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'other', label: 'Other' },
];

const REASON_LABELS: Record<CommentReportReason, string> = {
  harassment: 'Harassment or bullying',
  hate: 'Hate or slurs',
  sexual: 'Sexual or graphic',
  spam: 'Spam or scam',
  other: 'Other',
};

export function isCommentReportReason(
  value: unknown
): value is CommentReportReason {
  return (
    typeof value === 'string' &&
    COMMENT_REPORT_REASON_VALUES.includes(value as CommentReportReason)
  );
}

export function commentReportReasonLabel(reason: CommentReportReason): string {
  return REASON_LABELS[reason];
}

export function getCommentReportDetailsError(details: string): string | null {
  if (details.trim().length > COMMENT_REPORT_DETAILS_MAX) {
    return `That’s a bit long. Keep it to ${COMMENT_REPORT_DETAILS_MAX} characters.`;
  }
  return null;
}

export type ValidatedCommentReport = {
  commentId: string;
  reason: CommentReportReason;
  details: string;
};

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function validateCommentReportBody(
  body: unknown,
  validateCommentId: (value: string | null) => ValidationResult<string>
): ValidationResult<ValidatedCommentReport> {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'The request body is malformed.' };
  }

  const record = body as {
    commentId?: unknown;
    reason?: unknown;
    details?: unknown;
  };

  const commentId =
    typeof record.commentId === 'string' ? record.commentId : '';
  const idValidation = validateCommentId(commentId);
  if (!idValidation.ok) {
    return { ok: false, message: 'The comment id is invalid.' };
  }

  if (!isCommentReportReason(record.reason)) {
    return { ok: false, message: 'Choose what’s wrong with this comment.' };
  }

  if (record.details !== undefined && typeof record.details !== 'string') {
    return { ok: false, message: 'The details field is invalid.' };
  }

  const details =
    typeof record.details === 'string' ? record.details.trim() : '';
  const detailsError = getCommentReportDetailsError(details);
  if (detailsError) {
    return { ok: false, message: detailsError };
  }

  return {
    ok: true,
    value: {
      commentId: idValidation.value,
      reason: record.reason,
      details,
    },
  };
}
