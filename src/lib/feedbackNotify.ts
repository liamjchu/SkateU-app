import { getModerationEmailConfig } from './spotRemovalNotify';
import {
  contactCategoryLabel,
  isContactCategory,
  isSpotProblemCategory,
  spotProblemCategoryLabel,
} from './userFeedback';
import type { UserFeedbackType } from '../types/userFeedback';

export type FeedbackNotification = {
  id: string;
  type: UserFeedbackType;
  category: string | null;
  message: string;
  userId: string;
  username: string | null;
  email: string;
  createdAt: string;
  spotId: string | null;
  spotName: string | null;
  screenshotUrl: string | null;
  metadata: Record<string, string>;
};

const TYPE_SUBJECT: Record<UserFeedbackType, string> = {
  contact: 'SkateU — New Contact Message',
  bug: 'SkateU — New Bug Report',
  feature: 'SkateU — New Feature Suggestion',
  spot_problem: 'SkateU — Spot Problem Report',
};

const TYPE_LABEL: Record<UserFeedbackType, string> = {
  contact: 'Contact message',
  bug: 'Bug report',
  feature: 'Feature suggestion',
  spot_problem: 'Spot problem report',
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function categoryLabel(
  type: UserFeedbackType,
  category: string | null
): string | null {
  if (!category) {
    return null;
  }
  if (type === 'contact' && isContactCategory(category)) {
    return contactCategoryLabel(category);
  }
  if (type === 'spot_problem' && isSpotProblemCategory(category)) {
    return spotProblemCategoryLabel(category);
  }
  return category;
}

function metadataLines(metadata: Record<string, string>): string[] {
  const labels: Record<string, string> = {
    appVersion: 'App version',
    buildNumber: 'Build',
    platform: 'Platform',
    osVersion: 'OS version',
    deviceModel: 'Device',
    route: 'Screen',
  };

  return Object.entries(labels)
    .filter(([key]) => (metadata[key] ?? '').length > 0)
    .map(([key, label]) => `${label}: ${metadata[key]}`);
}

export function buildFeedbackEmail(input: FeedbackNotification): {
  subject: string;
  text: string;
  html: string;
} {
  const typeLabel = TYPE_LABEL[input.type];
  const category = categoryLabel(input.type, input.category);
  const username = input.username ? `@${input.username}` : 'unknown';
  const email = input.email.length > 0 ? input.email : 'unknown';
  const diagnosticLines = metadataLines(input.metadata);

  const textLines = [
    `New SkateU ${typeLabel.toLowerCase()}.`,
    `Report ID: ${input.id}`,
    `Submitted: ${input.createdAt}`,
    `User: ${username} (${input.userId})`,
    `Email: ${email}`,
  ];

  if (category) {
    textLines.push(`Category: ${category}`);
  }
  if (input.spotId) {
    textLines.push(`Spot: ${input.spotName ?? 'Unknown'} (${input.spotId})`);
  }
  if (input.message.length > 0) {
    textLines.push('', 'Message:', input.message);
  }
  if (diagnosticLines.length > 0) {
    textLines.push('', 'Device / app:', ...diagnosticLines.map((line) => `- ${line}`));
  }
  if (input.screenshotUrl) {
    textLines.push('', `Screenshot: ${input.screenshotUrl}`);
  }
  textLines.push('', 'Review in Supabase:', 'select * from public.user_feedback order by created_at desc;');

  const htmlParts = [
    `<p>New SkateU ${escapeHtml(typeLabel.toLowerCase())}.</p>`,
    `<p>Report ID: ${escapeHtml(input.id)}<br/>Submitted: ${escapeHtml(input.createdAt)}<br/>User: ${escapeHtml(username)} (${escapeHtml(input.userId)})<br/>Email: ${escapeHtml(email)}</p>`,
  ];

  if (category) {
    htmlParts.push(`<p>Category: ${escapeHtml(category)}</p>`);
  }
  if (input.spotId) {
    htmlParts.push(
      `<p>Spot: ${escapeHtml(input.spotName ?? 'Unknown')} (${escapeHtml(input.spotId)})</p>`
    );
  }
  if (input.message.length > 0) {
    htmlParts.push(`<p>${escapeHtml(input.message).replace(/\n/g, '<br/>')}</p>`);
  }
  if (diagnosticLines.length > 0) {
    htmlParts.push(
      `<p>Device / app:</p><ul>${diagnosticLines
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join('')}</ul>`
    );
  }
  if (input.screenshotUrl) {
    htmlParts.push(
      `<p>Screenshot: <a href="${escapeHtml(input.screenshotUrl)}">${escapeHtml(input.screenshotUrl)}</a></p>`
    );
  }
  htmlParts.push(
    '<p>Review in Supabase: <code>select * from public.user_feedback order by created_at desc;</code></p>'
  );

  return {
    subject: TYPE_SUBJECT[input.type],
    text: textLines.join('\n'),
    html: htmlParts.join(''),
  };
}

export async function sendFeedbackEmail(
  input: FeedbackNotification,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  const config = getModerationEmailConfig();
  if (!config) {
    console.info(
      'Skipping feedback email; RESEND_API_KEY, RESEND_FROM_EMAIL, or MODERATION_NOTIFY_EMAIL is unset.'
    );
    return false;
  }

  const email = buildFeedbackEmail(input);
  const payload: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
    reply_to?: string;
  } = {
    from: config.fromEmail,
    to: [config.notifyEmail],
    subject: email.subject,
    html: email.html,
    text: email.text,
  };

  if (input.email.length > 0) {
    payload.reply_to = input.email;
  }

  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Resend failed with status ${response.status}`);
  }

  return true;
}
