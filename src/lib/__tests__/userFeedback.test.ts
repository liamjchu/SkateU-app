import { validateSpotId } from '../../app/api/spots+api';
import {
  FEEDBACK_EMAIL_MAX,
  FEEDBACK_MESSAGE_MAX,
  METADATA_VALUE_MAX,
  SPOT_PROBLEM_DETAILS_MAX,
  canAttemptSupportSubmit,
  getFeedbackEmailError,
  getFeedbackMessageError,
  sanitizeClientMetadata,
  validateFeedbackBody,
} from '../userFeedback';

describe('canAttemptSupportSubmit', () => {
  it('blocks a second submit while the first is in flight', () => {
    expect(canAttemptSupportSubmit(false)).toBe(true);
    expect(canAttemptSupportSubmit(true)).toBe(false);
  });
});

describe('getFeedbackMessageError', () => {
  it('requires a message for contact, bugs, and feature ideas', () => {
    expect(getFeedbackMessageError('contact', '')).toBe('Write a message.');
    expect(getFeedbackMessageError('bug', '   ')).toBe('Tell us what happened.');
    expect(getFeedbackMessageError('feature', '')).toBe('Tell us your idea.');
  });

  it('allows empty optional details on a spot problem', () => {
    expect(getFeedbackMessageError('spot_problem', '')).toBeNull();
    expect(getFeedbackMessageError('spot_problem', '   ')).toBeNull();
  });

  it('rejects messages over the type-specific max', () => {
    expect(
      getFeedbackMessageError('contact', 'a'.repeat(FEEDBACK_MESSAGE_MAX + 1))
    ).toContain(String(FEEDBACK_MESSAGE_MAX));
    expect(
      getFeedbackMessageError('spot_problem', 'a'.repeat(SPOT_PROBLEM_DETAILS_MAX + 1))
    ).toContain(String(SPOT_PROBLEM_DETAILS_MAX));
  });
});

describe('getFeedbackEmailError', () => {
  it('rejects missing and malformed emails', () => {
    expect(getFeedbackEmailError('')).toBe('Enter an email so we can get back to you.');
    expect(getFeedbackEmailError('not-an-email')).toBe('Enter a valid email address.');
    expect(getFeedbackEmailError(`${'a'.repeat(FEEDBACK_EMAIL_MAX)}@x.com`)).toBe(
      'Enter a valid email address.'
    );
  });

  it('accepts a normal email', () => {
    expect(getFeedbackEmailError('skater@example.com')).toBeNull();
  });
});

describe('sanitizeClientMetadata', () => {
  it('keeps the diagnostic allowlist and drops identity fields', () => {
    expect(
      sanitizeClientMetadata({
        appVersion: '1.0.0',
        buildNumber: '12',
        platform: 'ios',
        osVersion: '18.0',
        deviceModel: 'iPhone',
        route: '/help/bug',
        userId: 'attacker',
        status: 'fixed',
        extra: 'nope',
      })
    ).toEqual({
      appVersion: '1.0.0',
      buildNumber: '12',
      platform: 'ios',
      osVersion: '18.0',
      deviceModel: 'iPhone',
      route: '/help/bug',
    });
  });

  it('clips overlong values', () => {
    const metadata = sanitizeClientMetadata({
      appVersion: 'v'.repeat(METADATA_VALUE_MAX + 20),
    });
    expect(metadata.appVersion).toHaveLength(METADATA_VALUE_MAX);
  });
});

describe('validateFeedbackBody', () => {
  it('accepts a valid contact message', () => {
    expect(
      validateFeedbackBody(
        {
          type: 'contact',
          category: 'partnership',
          message: '  Let’s collab  ',
          email: 'press@example.com',
        },
        validateSpotId
      )
    ).toEqual({
      ok: true,
      value: {
        type: 'contact',
        category: 'partnership',
        message: 'Let’s collab',
        spotId: null,
        contactEmail: 'press@example.com',
        metadata: {},
      },
    });
  });

  it('rejects a missing contact message', () => {
    expect(
      validateFeedbackBody(
        { type: 'contact', category: 'general', message: '' },
        validateSpotId
      )
    ).toEqual({ ok: false, message: 'Write a message.' });
  });

  it('rejects an invalid user-entered email', () => {
    expect(
      validateFeedbackBody(
        {
          type: 'contact',
          category: 'general',
          message: 'Hello',
          email: 'nope',
        },
        validateSpotId
      )
    ).toEqual({ ok: false, message: 'Enter a valid email address.' });
  });

  it('rejects a missing bug description', () => {
    expect(
      validateFeedbackBody({ type: 'bug', message: '' }, validateSpotId)
    ).toEqual({ ok: false, message: 'Tell us what happened.' });
  });

  it('rejects a missing feature idea', () => {
    expect(
      validateFeedbackBody({ type: 'feature', message: '' }, validateSpotId)
    ).toEqual({ ok: false, message: 'Tell us your idea.' });
  });

  it('requires a spot id and valid reason for spot problems', () => {
    expect(
      validateFeedbackBody(
        { type: 'spot_problem', category: 'incorrect_photo' },
        validateSpotId
      )
    ).toEqual({
      ok: false,
      message: 'This needs a spot. Head back to the map and try again.',
    });

    expect(
      validateFeedbackBody(
        { type: 'spot_problem', category: 'nope', spotId: 'spot-1' },
        validateSpotId
      )
    ).toEqual({ ok: false, message: 'Choose what’s wrong with this spot.' });
  });

  it('accepts a spot problem with optional details and metadata', () => {
    expect(
      validateFeedbackBody(
        {
          type: 'spot_problem',
          category: 'spot_changed',
          spotId: 'spot-1',
          message: '  rail is gone  ',
          metadata: { platform: 'ios', userId: 'attacker' },
        },
        validateSpotId
      )
    ).toEqual({
      ok: true,
      value: {
        type: 'spot_problem',
        category: 'spot_changed',
        message: 'rail is gone',
        spotId: 'spot-1',
        contactEmail: null,
        metadata: { platform: 'ios' },
      },
    });
  });
});
