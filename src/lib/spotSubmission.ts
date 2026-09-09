export const SPOT_SUBMISSION_TIMEOUT_MS = 60_000;

export const SUBMISSION_CANCELLED_ERROR =
  'Submission cancelled. You can try again.';

export const SUBMISSION_STALE_ERROR =
  'This didn’t finish sending. You can try again.';

export const CANCEL_SUBMISSION_TITLE = 'Stop sending this spot?';
export const CANCEL_SUBMISSION_MESSAGE =
  'It will stay in Drafts so you can submit it again. If it already went through, it may still show up on the map.';

export class SpotSubmissionCancelledError extends Error {
  constructor() {
    super(SUBMISSION_CANCELLED_ERROR);
    this.name = 'SpotSubmissionCancelledError';
  }
}

export function isSpotSubmissionCancelledError(error: unknown): boolean {
  return error instanceof SpotSubmissionCancelledError;
}

const controllers = new Map<string, AbortController>();

export function beginDraftSubmission(draftId: string): AbortSignal {
  abortDraftSubmission(draftId);
  const controller = new AbortController();
  controllers.set(draftId, controller);
  return controller.signal;
}

export function finishDraftSubmission(
  draftId: string,
  signal?: AbortSignal
): void {
  const current = controllers.get(draftId);
  if (!current) {
    return;
  }
  if (signal && current.signal !== signal) {
    return;
  }
  controllers.delete(draftId);
}

export function abortDraftSubmission(draftId: string): boolean {
  const controller = controllers.get(draftId);
  if (!controller) {
    return false;
  }
  controllers.delete(draftId);
  controller.abort();
  return true;
}

export function isDraftSubmissionInFlight(draftId: string): boolean {
  return controllers.has(draftId);
}

export function resetDraftSubmissions(): void {
  for (const controller of controllers.values()) {
    controller.abort();
  }
  controllers.clear();
}
