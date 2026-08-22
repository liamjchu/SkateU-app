import * as userFeedbackRoute from '../user-feedback+api';
import { POST } from '../user-feedback+api';
import { FEEDBACK_SAFETY_REJECT_MESSAGE } from '../../../lib/feedbackModeration';
import { FEEDBACK_MESSAGE_MAX, USER_FEEDBACK_PER_DAY } from '../../../lib/userFeedback';

type FetchMock = jest.Mock<Promise<Response>, [string | URL | Request, RequestInit?]>;

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function setConfigured(): void {
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret-key';
}

function setResendConfigured(): void {
  process.env.RESEND_API_KEY = 're_test';
  process.env.RESEND_FROM_EMAIL = 'SkateU <hello@example.com>';
  process.env.MODERATION_NOTIFY_EMAIL = 'owner@example.com';
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function postRequest(body: unknown, token = 'good-token'): Request {
  return new Request('https://app.test/api/user-feedback', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('user-feedback route surface', () => {
  it('only exposes POST', () => {
    expect(userFeedbackRoute).toHaveProperty('POST');
    expect(userFeedbackRoute).not.toHaveProperty('GET');
    expect(userFeedbackRoute).not.toHaveProperty('PATCH');
    expect(userFeedbackRoute).not.toHaveProperty('DELETE');
  });
});

describe('POST /api/user-feedback', () => {
  it('returns 401 when the Authorization header is absent', async () => {
    setConfigured();
    const response = await POST(
      new Request('https://app.test/api/user-feedback', {
        method: 'POST',
        body: JSON.stringify({ type: 'contact', category: 'general', message: 'Hi' }),
      })
    );
    expect(response.status).toBe(401);
  });

  it('returns 400 when the message is missing', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      jsonResponse({ id: 'user-1', email: 'skater@example.com' })
    ) as unknown as typeof fetch;

    const response = await POST(
      postRequest({ type: 'contact', category: 'general', message: '' })
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Write a message.' });
  });

  it('returns 400 when a user-entered email is invalid', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      jsonResponse({ id: 'user-1' })
    ) as unknown as typeof fetch;

    const response = await POST(
      postRequest({
        type: 'contact',
        category: 'general',
        message: 'Hello',
        email: 'not-an-email',
      })
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Enter a valid email address.',
    });
  });

  it('returns 400 when a bug description is missing', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      jsonResponse({ id: 'user-1', email: 'skater@example.com' })
    ) as unknown as typeof fetch;

    const response = await POST(postRequest({ type: 'bug', message: '' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Tell us what happened.',
    });
  });

  it('inserts contact feedback as the verified user and emails the admin inbox', async () => {
    setConfigured();
    setResendConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1', email: 'skater@example.com' });
      }
      if (url.includes('/rest/v1/user_feedback') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as {
          user_id: string;
          status: string;
          type: string;
          category: string;
          message: string;
          contact_email: string;
        };
        expect(payload.user_id).toBe('user-1');
        expect(payload.status).toBe('new');
        expect(payload.type).toBe('contact');
        expect(payload.category).toBe('feedback');
        expect(payload.message).toBe('Loved the map');
        expect(payload.contact_email).toBe('skater@example.com');
        return jsonResponse(
          [{ id: 'fb-1', created_at: '2026-08-20T14:00:00.000Z' }],
          201
        );
      }
      if (url.includes('/rest/v1/user_feedback')) {
        return jsonResponse([]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([{ username: 'skater' }]);
      }
      if (url.includes('api.resend.com')) {
        return jsonResponse({ id: 'email-1' });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({
        type: 'contact',
        category: 'feedback',
        message: 'Loved the map',
        userId: 'attacker',
        status: 'fixed',
        to: 'attacker@evil.test',
      })
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: 'fb-1' });

    const resendCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('api.resend.com')
    );
    expect(resendCalls).toHaveLength(1);
    const emailBody = JSON.parse(String(resendCalls[0][1]?.body)) as {
      to: string[];
      subject: string;
      reply_to?: string;
    };
    expect(emailBody.to).toEqual(['owner@example.com']);
    expect(emailBody.subject).toBe('SkateU — New Contact Message');
    expect(emailBody.reply_to).toBe('skater@example.com');
  });

  it('attaches sanitized metadata on a bug report', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1', email: 'skater@example.com' });
      }
      if (url.includes('/rest/v1/user_feedback') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as {
          metadata: Record<string, string>;
          status: string;
          user_id: string;
        };
        expect(payload.user_id).toBe('user-1');
        expect(payload.status).toBe('new');
        expect(payload.metadata).toEqual({
          platform: 'ios',
          appVersion: '1.0.0',
          username: 'skater',
        });
        expect(payload.metadata).not.toHaveProperty('userId');
        return jsonResponse(
          [{ id: 'fb-bug', created_at: '2026-08-20T14:00:00.000Z' }],
          201
        );
      }
      if (url.includes('/rest/v1/user_feedback')) {
        return jsonResponse([]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([{ username: 'skater' }]);
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({
        type: 'bug',
        message: 'The pin vanished',
        metadata: {
          platform: 'ios',
          appVersion: '1.0.0',
          userId: 'attacker',
          status: 'fixed',
        },
      })
    );
    expect(response.status).toBe(201);
  });

  it('rejects an unsupported screenshot type', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      jsonResponse({ id: 'user-1', email: 'skater@example.com' })
    ) as unknown as typeof fetch;

    const form = new FormData();
    form.append('type', 'bug');
    form.append('message', 'It crashed');
    form.append(
      'screenshot',
      new File([Uint8Array.from([1, 2, 3])], 'bug.gif', { type: 'image/gif' })
    );

    const response = await POST(
      new Request('https://app.test/api/user-feedback', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: form,
      })
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('JPEG');
  });

  it('uploads a screenshot and includes a signed URL in the admin email', async () => {
    setConfigured();
    setResendConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1', email: 'skater@example.com' });
      }
      if (url.includes('/storage/v1/object/sign/')) {
        return jsonResponse({ signedURL: '/object/sign/feedback-attachments/shot.jpg?token=abc' });
      }
      if (url.includes('/storage/v1/object/feedback-attachments/')) {
        return jsonResponse({}, 200);
      }
      if (url.includes('/rest/v1/user_feedback') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as { attachment_path: string | null };
        expect(payload.attachment_path).toContain('user-1/');
        return jsonResponse(
          [{ id: 'fb-shot', created_at: '2026-08-20T14:00:00.000Z' }],
          201
        );
      }
      if (url.includes('/rest/v1/user_feedback')) {
        return jsonResponse([]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([{ username: 'skater' }]);
      }
      if (url.includes('api.resend.com')) {
        return jsonResponse({ id: 'email-1' });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const form = new FormData();
    form.append('type', 'bug');
    form.append('message', 'It crashed');
    form.append(
      'screenshot',
      new File([Uint8Array.from([1, 2, 3, 4])], 'bug.jpg', { type: 'image/jpeg' })
    );

    const response = await POST(
      new Request('https://app.test/api/user-feedback', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: form,
      })
    );
    expect(response.status).toBe(201);

    const resendCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('api.resend.com')
    );
    const emailBody = JSON.parse(String(resendCalls[0][1]?.body)) as { text: string };
    expect(emailBody.text).toContain(
      'https://project.supabase.co/storage/v1/object/sign/feedback-attachments/shot.jpg?token=abc'
    );
  });

  it('stores a feature suggestion with metadata', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1', email: 'skater@example.com' });
      }
      if (url.includes('/rest/v1/user_feedback') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as {
          type: string;
          category: string | null;
          metadata: Record<string, string>;
        };
        expect(payload.type).toBe('feature');
        expect(payload.category).toBeNull();
        expect(payload.metadata.platform).toBe('android');
        return jsonResponse(
          [{ id: 'fb-feat', created_at: '2026-08-20T14:00:00.000Z' }],
          201
        );
      }
      if (url.includes('/rest/v1/user_feedback')) {
        return jsonResponse([]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([]);
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({
        type: 'feature',
        message: 'Add night mode',
        metadata: { platform: 'android' },
      })
    );
    expect(response.status).toBe(201);
  });

  it('attaches the server-known spot id and returns 404 when the spot is gone', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1', email: 'skater@example.com' });
      }
      if (url.includes('/rest/v1/spots')) {
        return jsonResponse([]);
      }
      if (url.includes('/rest/v1/user_feedback')) {
        return jsonResponse([]);
      }
      throw new Error(`unexpected fetch ${url} ${init?.method ?? ''}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({
        type: 'spot_problem',
        category: 'incorrect_location',
        spotId: 'spot-1',
        userId: 'someone-else',
      })
    );
    expect(response.status).toBe(404);
  });

  it('stores a spot problem against the verified user, not a client-supplied user id', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1', email: 'skater@example.com' });
      }
      if (url.includes('/rest/v1/spots')) {
        return jsonResponse([{ id: 'spot-1', name: 'Davis Gap', status: 'active' }]);
      }
      if (url.includes('/rest/v1/user_feedback') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as {
          user_id: string;
          spot_id: string;
          type: string;
          category: string;
          metadata: Record<string, string>;
        };
        expect(payload.user_id).toBe('user-1');
        expect(payload.spot_id).toBe('spot-1');
        expect(payload.type).toBe('spot_problem');
        expect(payload.category).toBe('incorrect_photo');
        expect(payload.metadata.spotName).toBe('Davis Gap');
        return jsonResponse(
          [{ id: 'fb-spot', created_at: '2026-08-20T14:00:00.000Z' }],
          201
        );
      }
      if (url.includes('/rest/v1/user_feedback')) {
        return jsonResponse([]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([{ username: 'skater' }]);
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({
        type: 'spot_problem',
        category: 'incorrect_photo',
        spotId: 'spot-1',
        message: 'Old photo',
        userId: 'attacker',
      })
    );
    expect(response.status).toBe(201);
  });

  it('returns 429 when the daily cap is reached', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1', email: 'skater@example.com' });
      }
      if (url.includes('/rest/v1/user_feedback')) {
        return jsonResponse(
          Array.from({ length: USER_FEEDBACK_PER_DAY }, (_, index) => ({
            id: `r${index}`,
          }))
        );
      }
      throw new Error('insert should not run');
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({ type: 'feature', message: 'More campuses' })
    );
    expect(response.status).toBe(429);
  });

  it('still succeeds when Resend env vars are missing', async () => {
    setConfigured();
    delete process.env.RESEND_API_KEY;
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1', email: 'skater@example.com' });
      }
      if (url.includes('/rest/v1/user_feedback') && init?.method === 'POST') {
        return jsonResponse(
          [{ id: 'fb-2', created_at: '2026-08-20T14:00:00.000Z' }],
          201
        );
      }
      if (url.includes('/rest/v1/user_feedback')) {
        return jsonResponse([]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([]);
      }
      if (url.includes('api.resend.com')) {
        throw new Error('Resend should not be called');
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({ type: 'contact', category: 'other', message: 'Hi' })
    );
    expect(response.status).toBe(201);
  });

  it('rejects overlong messages before touching the database', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      jsonResponse({ id: 'user-1', email: 'skater@example.com' })
    ) as unknown as typeof fetch;

    const response = await POST(
      postRequest({
        type: 'bug',
        message: 'a'.repeat(FEEDBACK_MESSAGE_MAX + 1),
      })
    );
    expect(response.status).toBe(400);
  });

  it('does not store or email a message flagged as sexual or threatening', async () => {
    setConfigured();
    setResendConfigured();
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1', email: 'skater@example.com' });
      }
      if (url.includes('/rest/v1/user_feedback') && init?.method === 'POST') {
        throw new Error('insert should not run');
      }
      if (url.includes('/rest/v1/user_feedback')) {
        return jsonResponse([]);
      }
      if (url.includes('api.openai.com/v1/moderations')) {
        return jsonResponse({
          results: [{ categories: { sexual: true } }],
        });
      }
      if (url.includes('api.resend.com')) {
        throw new Error('Resend should not be called');
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({
        type: 'contact',
        category: 'general',
        message: 'flagged payload',
      })
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: FEEDBACK_SAFETY_REJECT_MESSAGE,
    });
  });

  it('still stores a message when the safety filter is unavailable', async () => {
    setConfigured();
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1', email: 'skater@example.com' });
      }
      if (url.includes('api.openai.com/v1/moderations')) {
        return jsonResponse({ error: 'unavailable' }, 500);
      }
      if (url.includes('/rest/v1/user_feedback') && init?.method === 'POST') {
        return jsonResponse(
          [{ id: 'fb-open', created_at: '2026-08-20T14:00:00.000Z' }],
          201
        );
      }
      if (url.includes('/rest/v1/user_feedback')) {
        return jsonResponse([]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([]);
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({ type: 'feature', message: 'Add night mode' })
    );
    expect(response.status).toBe(201);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('sends an attached screenshot to the safety filter before upload', async () => {
    setConfigured();
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1', email: 'skater@example.com' });
      }
      if (url.includes('api.openai.com/v1/moderations')) {
        const body = JSON.parse(String(init?.body)) as {
          input: { type: string; image_url?: { url: string } }[];
        };
        expect(body.input.some((part) => part.type === 'image_url')).toBe(true);
        return jsonResponse({
          results: [{ categories: { 'harassment/threatening': true } }],
        });
      }
      if (url.includes('/storage/v1/object/')) {
        throw new Error('upload should not run');
      }
      if (url.includes('/rest/v1/user_feedback') && init?.method === 'POST') {
        throw new Error('insert should not run');
      }
      if (url.includes('/rest/v1/user_feedback')) {
        return jsonResponse([]);
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const form = new FormData();
    form.append('type', 'bug');
    form.append('message', 'It crashed');
    form.append(
      'screenshot',
      new File([Uint8Array.from([1, 2, 3, 4])], 'bug.jpg', { type: 'image/jpeg' })
    );

    const response = await POST(
      new Request('https://app.test/api/user-feedback', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: form,
      })
    );
    expect(response.status).toBe(422);
  });
});
