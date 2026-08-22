import { validateSpotId } from '../../app/api/spots+api';
import {
  COMMENT_REPORT_DETAILS_MAX,
  getCommentReportDetailsError,
  isCommentReportReason,
  validateCommentReportBody,
} from '../commentReport';

const commentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('isCommentReportReason', () => {
  it('accepts the allowed reasons', () => {
    expect(isCommentReportReason('harassment')).toBe(true);
    expect(isCommentReportReason('hate')).toBe(true);
    expect(isCommentReportReason('nope')).toBe(false);
  });
});

describe('getCommentReportDetailsError', () => {
  it('rejects details over the max length', () => {
    expect(getCommentReportDetailsError('a'.repeat(COMMENT_REPORT_DETAILS_MAX + 1))).toBe(
      `That’s a bit long. Keep it to ${COMMENT_REPORT_DETAILS_MAX} characters.`
    );
    expect(getCommentReportDetailsError('short')).toBeNull();
  });
});

describe('validateCommentReportBody', () => {
  it('accepts a trimmed report', () => {
    expect(
      validateCommentReportBody(
        {
          commentId,
          reason: 'spam',
          details: '  Repeated ads.  ',
        },
        validateSpotId
      )
    ).toEqual({
      ok: true,
      value: {
        commentId,
        reason: 'spam',
        details: 'Repeated ads.',
      },
    });
  });

  it('rejects a missing reason', () => {
    const result = validateCommentReportBody({ commentId }, validateSpotId);
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid comment id', () => {
    const result = validateCommentReportBody(
      { commentId: 'not an id', reason: 'other' },
      validateSpotId
    );
    expect(result.ok).toBe(false);
  });
});
