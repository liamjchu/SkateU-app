import { buildFeedbackEmail } from '../feedbackNotify';
import { getModerationEmailConfig } from '../spotRemovalNotify';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('feedback notify env', () => {
  it('reuses the existing moderation Resend variables', () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM_EMAIL = 'SkateU <hello@example.com>';
    process.env.MODERATION_NOTIFY_EMAIL = 'owner@example.com';
    expect(getModerationEmailConfig()).toEqual({
      apiKey: 're_test',
      fromEmail: 'SkateU <hello@example.com>',
      notifyEmail: 'owner@example.com',
    });
  });
});

describe('buildFeedbackEmail', () => {
  const base = {
    id: 'fb-1',
    userId: 'user-1',
    username: 'skater',
    email: 'skater@example.com',
    createdAt: '2026-08-20T14:00:00.000Z',
    message: 'Hello <team>',
    category: null as string | null,
    spotId: null as string | null,
    spotName: null as string | null,
    screenshotUrl: null as string | null,
    metadata: { platform: 'ios', appVersion: '1.0.0' },
  };

  it('uses a distinct subject per report type', () => {
    expect(buildFeedbackEmail({ ...base, type: 'contact', category: 'press' }).subject).toBe(
      'SkateU — New Contact Message'
    );
    expect(buildFeedbackEmail({ ...base, type: 'bug' }).subject).toBe(
      'SkateU — New Bug Report'
    );
    expect(buildFeedbackEmail({ ...base, type: 'feature' }).subject).toBe(
      'SkateU — New Feature Suggestion'
    );
    expect(
      buildFeedbackEmail({
        ...base,
        type: 'spot_problem',
        category: 'incorrect_location',
        spotId: 'spot-1',
        spotName: 'Davis Gap',
      }).subject
    ).toBe('SkateU — Spot Problem Report');
  });

  it('escapes HTML and includes identity, metadata, and screenshot', () => {
    const email = buildFeedbackEmail({
      ...base,
      type: 'bug',
      screenshotUrl: 'https://example.test/shot',
    });

    expect(email.text).toContain('Report ID: fb-1');
    expect(email.text).toContain('@skater');
    expect(email.text).toContain('skater@example.com');
    expect(email.text).toContain('Hello <team>');
    expect(email.text).toContain('Platform: ios');
    expect(email.text).toContain('https://example.test/shot');
    expect(email.html).toContain('Hello &lt;team&gt;');
    expect(email.html).not.toContain('Hello <team>');
  });
});
