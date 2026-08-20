import { spotRemovalReasonLabel } from './spotRemovalRequest';
import type { SpotRemovalReason } from '../types/spotRemovalRequest';

export type SpotReviewNotification = {
  spotId: string;
  spotName: string;
  schoolName: string;
  uniqueRequestCount: number;
  reasons: SpotRemovalReason[];
  details: string[];
};

type ResendConfig = {
  apiKey: string;
  fromEmail: string;
  notifyEmail: string;
};

export function getModerationEmailConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  const notifyEmail = process.env.MODERATION_NOTIFY_EMAIL?.trim();

  if (!apiKey || !fromEmail || !notifyEmail) {
    return null;
  }

  return { apiKey, fromEmail, notifyEmail };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSpotReviewEmail(input: SpotReviewNotification): {
  subject: string;
  text: string;
  html: string;
} {
  const reasonLines = input.reasons.map((reason, index) => {
    const label = spotRemovalReasonLabel(reason);
    const extra = input.details[index]?.trim();
    return extra ? `${label}: ${extra}` : label;
  });

  const schoolLine = input.schoolName.length > 0 ? input.schoolName : 'Unknown campus';
  const text = [
    `${input.spotName} has received ${input.uniqueRequestCount} removal requests.`,
    `Campus: ${schoolLine}`,
    `Spot id: ${input.spotId}`,
    '',
    'Reasons:',
    ...reasonLines.map((line) => `- ${line}`),
    '',
    'Review in Supabase:',
    'select * from public.spots_needing_review;',
  ].join('\n');

  const htmlReasons = reasonLines
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join('');

  const html = [
    `<p>${escapeHtml(input.spotName)} has received ${input.uniqueRequestCount} removal requests.</p>`,
    `<p>Campus: ${escapeHtml(schoolLine)}<br/>Spot id: ${escapeHtml(input.spotId)}</p>`,
    '<p>Reasons:</p>',
    `<ul>${htmlReasons}</ul>`,
    '<p>Review in Supabase: <code>select * from public.spots_needing_review;</code></p>',
  ].join('');

  return {
    subject: 'SkateU spot needs review',
    text,
    html,
  };
}

export async function sendSpotReviewEmail(
  input: SpotReviewNotification,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  const config = getModerationEmailConfig();
  if (!config) {
    console.info(
      'Skipping spot review email; RESEND_API_KEY, RESEND_FROM_EMAIL, or MODERATION_NOTIFY_EMAIL is unset.'
    );
    return false;
  }

  const email = buildSpotReviewEmail(input);
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
