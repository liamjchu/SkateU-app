import fc from 'fast-check';
import {
    COMMENT_CONTENT_MAX,
    getCommentContentError,
    isCommentContentValid,
    prefilterComment,
} from '../commentForm';

describe('getCommentContentError', () => {
  it('accepts trimmed comments between 1 and 500 characters', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: COMMENT_CONTENT_MAX }), (value) => {
        const trimmed = value.trim();
        if (trimmed.length === 0 || trimmed.length > COMMENT_CONTENT_MAX) {
          expect(isCommentContentValid(value)).toBe(false);
          return;
        }
        expect(getCommentContentError(value)).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('rejects blank comments', () => {
    expect(getCommentContentError('   ')).toBe('Still needs a comment.');
  });

  it('rejects comments over the max length', () => {
    expect(getCommentContentError('a'.repeat(COMMENT_CONTENT_MAX + 1))).toContain(
      String(COMMENT_CONTENT_MAX)
    );
  });
});

describe('prefilterComment', () => {
  it('allows ordinary skate talk', () => {
    expect(prefilterComment('This ledge is perfect after rain.')).toEqual({ ok: true });
  });

  it('rejects SSN-like and card-like numeric strings', () => {
    expect(prefilterComment('123456789').ok).toBe(false);
    expect(prefilterComment('4111111111111111').ok).toBe(false);
  });

  it('rejects repeated-character spam', () => {
    expect(prefilterComment('aaaaaaaaaaaa').ok).toBe(false);
  });

  it('rejects blocked tokens without treating them as substrings of other words', () => {
    expect(prefilterComment('this is shit').ok).toBe(false);
    expect(prefilterComment('assassin row is clean').ok).toBe(true);
  });
});
