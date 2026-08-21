import { commentReportReasonLabel } from './commentReport';
import { getModerationEmailConfig } from './spotRemovalNotify';
import type { CommentReportReason } from '../types/commentReport';

export type CommentReportNotification = {
  reportId: string;
  commentId: string;
  spotId: string;
  reason: CommentReportReason;
  details: string;
  commentContent: string;
  reporterId: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildCommentReportEmail(input: CommentReportNotification): {
  subject: string;
  text: string;
  html: string;
} {
  const reason = commentReportReasonLabel(input.reason);
  const extra = input.details.trim();
  const text = [
    'A comment was reported in SkateU.',
    `Reason: ${reason}${extra ? ` — ${extra}` : ''}`,
    `Comment id: ${input.commentId}`,
    `Spot id: ${input.spotId}`,
    `Report id: ${input.reportId}`,
    `Reporter id: ${input.reporterId}`,
    '',
    'Comment:',
    input.commentContent,
    '',
    'Review in Supabase:',
    'select * from public.comment_reports order by created_at desc;',
  ].join('\n');

  const html = [
    '<p>A comment was reported in SkateU.</p>',
    `<p>Reason: ${escapeHtml(reason)}${
      extra ? ` — ${escapeHtml(extra)}` : ''
    }</p>`,
    `<p>Comment id: ${escapeHtml(input.commentId)}<br/>Spot id: ${escapeHtml(
      input.spotId
    )}<br/>Report id: ${escapeHtml(input.reportId)}<br/>Reporter id: ${escapeHtml(
      input.reporterId
    )}</p>`,
    `<p>Comment:</p><p>${escapeHtml(input.commentContent)}</p>`,
    '<p>Review in Supabase: <code>select * from public.comment_reports order by created_at desc;</code></p>',
  ].join('');

  return {
    subject: 'SkateU comment report',
    text,
    html,
  };
}

export async function sendCommentReportEmail(
  input: CommentReportNotification,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  const config = getModerationEmailConfig();
  if (!config) {
    console.info(
      'Skipping comment report email; RESEND_API_KEY, RESEND_FROM_EMAIL, or MODERATION_NOTIFY_EMAIL is unset.'
    );
    return false;
  }

  const email = buildCommentReportEmail(input);
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.fromEmail,
      to: [config.notifyEmail],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend failed with status ${response.status}`);
  }

  return true;
}
