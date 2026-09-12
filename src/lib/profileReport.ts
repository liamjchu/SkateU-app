import {
  COMMENT_REPORT_REASON_OPTIONS,
  COMMENT_REPORT_DETAILS_MAX,
  getCommentReportDetailsError,
  isCommentReportReason,
} from './commentReport';
import type { CommentReportReason } from '../types/commentReport';

export const PROFILE_REPORT_REASON_OPTIONS = COMMENT_REPORT_REASON_OPTIONS;
export const PROFILE_REPORT_DETAILS_MAX = COMMENT_REPORT_DETAILS_MAX;

export function isProfileReportReason(
  value: unknown
): value is CommentReportReason {
  return isCommentReportReason(value);
}

export function getProfileReportDetailsError(details: string): string | null {
  return getCommentReportDetailsError(details);
}

export function buildProfileReportMessage(input: {
  userId: string;
  username?: string;
  reason: CommentReportReason;
  details: string;
}): string {
  const lines = [
    `Reported profile: ${input.username ? `@${input.username}` : 'unknown username'}`,
    `User id: ${input.userId}`,
    `Reason: ${input.reason}`,
  ];
  if (input.details.trim().length > 0) {
    lines.push(`Details: ${input.details.trim()}`);
  }
  return lines.join('\n');
}
