import {
  buildCommentReportEmail,
  sendCommentReportEmail,
  type CommentReportNotification,
} from '../commentReportNotify';

const originalEnv = { ...process.env };

const report: CommentReportNotification = {
  reportId: 'report-1',
  commentId: 'comment-1',
  spotId: 'spot-1',
  reason: 'harassment',
  details: 'Called names in replies',
  commentContent: 'Hello <team> & "friends"',
  reporterId: 'user-2',
};

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('buildCommentReportEmail', () => {
  it('includes ids, reason, extra details, and escaped HTML', () => {
    const email = buildCommentReportEmail(report);

    expect(email.subject).toBe('SkateU comment report');
    expect(email.text).toContain(
      'Reason: Harassment or bullying — Called names in replies'
    );
    expect(email.text).toContain('Comment id: comment-1');
    expect(email.text).toContain('Hello <team> & "friends"');
    expect(email.html).toContain('Hello &lt;team&gt; &amp; &quot;friends&quot;');
    expect(email.html).not.toContain('Hello <team>');
  });

  it('omits extra details when they are blank', () => {
    const email = buildCommentReportEmail({ ...report, details: '   ' });
    expect(email.text).toContain('Reason: Harassment or bullying\n');
    expect(email.text).not.toContain('Reason: Harassment or bullying —');
    expect(email.html).toContain('Reason: Harassment or bullying</p>');
  });
});

describe('sendCommentReportEmail', () => {
  it('skips sending when Resend env vars are missing', async () => {
    delete process.env.RESEND_API_KEY;
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const fetchImpl = jest.fn();

    await expect(sendCommentReportEmail(report, fetchImpl)).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
  });

  it('sends through Resend when configured', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM_EMAIL = 'SkateU <hello@example.com>';
    process.env.MODERATION_NOTIFY_EMAIL = 'owner@example.com';
    const fetchImpl = jest.fn(async () => new Response('{}', { status: 200 }));

    await expect(sendCommentReportEmail(report, fetchImpl)).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test',
        }),
      })
    );
  });

  it('throws when Resend rejects the request', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM_EMAIL = 'SkateU <hello@example.com>';
    process.env.MODERATION_NOTIFY_EMAIL = 'owner@example.com';
    const fetchImpl = jest.fn(async () => new Response('nope', { status: 500 }));

    await expect(sendCommentReportEmail(report, fetchImpl)).rejects.toThrow(
      'Resend failed with status 500'
    );
  });
});
