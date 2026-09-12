import { buildProfileReportMessage, getProfileReportDetailsError } from '../profileReport';

describe('profileReport', () => {
  it('builds a report message with username and details', () => {
    expect(
      buildProfileReportMessage({
        userId: 'user-1',
        username: 'skater',
        reason: 'harassment',
        details: 'Targeting people in comments.',
      })
    ).toBe(
      'Reported profile: @skater\nUser id: user-1\nReason: harassment\nDetails: Targeting people in comments.'
    );
  });

  it('omits details when they are blank', () => {
    expect(
      buildProfileReportMessage({
        userId: 'user-1',
        reason: 'other',
        details: '   ',
      })
    ).toBe('Reported profile: unknown username\nUser id: user-1\nReason: other');
  });

  it('reuses the comment-report details limit', () => {
    expect(getProfileReportDetailsError('ok')).toBeNull();
    expect(getProfileReportDetailsError('x'.repeat(501))).toMatch(/500/);
  });
});
