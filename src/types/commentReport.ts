export const COMMENT_REPORT_REASON_VALUES = [
  'harassment',
  'hate',
  'sexual',
  'spam',
  'other',
] as const;

export type CommentReportReason = (typeof COMMENT_REPORT_REASON_VALUES)[number];

export type CommentReportReasonOption = {
  value: CommentReportReason;
  label: string;
};

export type CommentReport = {
  id: string;
  commentId: string;
  reason: CommentReportReason;
  details: string;
  createdAt: string;
};
