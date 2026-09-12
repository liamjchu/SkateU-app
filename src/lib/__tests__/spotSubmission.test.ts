import {
  abortDraftSubmission,
  beginDraftSubmission,
  finishDraftSubmission,
  isDraftSubmissionInFlight,
  isSpotSubmissionCancelledError,
  resetDraftSubmissions,
  SpotSubmissionCancelledError,
} from '../spotSubmission';

describe('spotSubmission', () => {
  afterEach(() => {
    resetDraftSubmissions();
  });

  it('tracks an in-flight abort signal per draft', () => {
    const signal = beginDraftSubmission('draft-1');

    expect(isDraftSubmissionInFlight('draft-1')).toBe(true);
    expect(signal.aborted).toBe(false);
    expect(isDraftSubmissionInFlight('draft-2')).toBe(false);
  });

  it('aborts the previous signal when a draft is submitted again', () => {
    const first = beginDraftSubmission('draft-1');
    const second = beginDraftSubmission('draft-1');

    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
    expect(isDraftSubmissionInFlight('draft-1')).toBe(true);
  });

  it('aborts and forgets a draft submission', () => {
    const signal = beginDraftSubmission('draft-1');

    expect(abortDraftSubmission('draft-1')).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(isDraftSubmissionInFlight('draft-1')).toBe(false);
    expect(abortDraftSubmission('draft-1')).toBe(false);
  });

  it('does not finish a newer in-flight submission for the same draft', () => {
    const first = beginDraftSubmission('draft-1');
    beginDraftSubmission('draft-1');

    finishDraftSubmission('draft-1', first);

    expect(isDraftSubmissionInFlight('draft-1')).toBe(true);
  });

  it('finishes the matching in-flight submission', () => {
    const signal = beginDraftSubmission('draft-1');
    finishDraftSubmission('draft-1', signal);

    expect(isDraftSubmissionInFlight('draft-1')).toBe(false);
  });

  it('identifies cancelled submission errors', () => {
    expect(isSpotSubmissionCancelledError(new SpotSubmissionCancelledError())).toBe(
      true
    );
    expect(isSpotSubmissionCancelledError(new Error('Aborted'))).toBe(false);
  });
});
