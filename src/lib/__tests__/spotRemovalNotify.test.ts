import {
  buildSpotReviewEmail,
  getModerationEmailConfig,
} from '../spotRemovalNotify';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getModerationEmailConfig', () => {
  it('returns null when any notify env var is missing', () => {
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_FROM_EMAIL = 'SkateU <hello@example.com>';
    process.env.MODERATION_NOTIFY_EMAIL = 'owner@example.com';
    expect(getModerationEmailConfig()).toBeNull();
  });

  it('returns the config when all notify env vars are set', () => {
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

describe('buildSpotReviewEmail', () => {
  it('includes the spot, count, and reasons without a moderation threshold', () => {
    const email = buildSpotReviewEmail({
      spotId: 'spot-1',
      spotName: 'Davis Gap',
      schoolName: 'UC Davis',
      uniqueRequestCount: 2,
      reasons: ['private_restricted', 'dangerous'],
      details: ['Behind the rec center', ''],
    });

    expect(email.subject).toBe('SkateU spot needs review');
    expect(email.text).toContain('Davis Gap has received 2 removal requests.');
    expect(email.text).toContain('Private/restricted area: Behind the rec center');
    expect(email.text).toContain('Dangerous');
    expect(email.text).not.toContain('under_review');
    expect(email.html).toContain('Davis Gap');
  });
});
