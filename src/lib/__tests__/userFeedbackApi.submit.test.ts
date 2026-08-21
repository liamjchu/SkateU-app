process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8081';

import { submitUserFeedback } from '../userFeedbackApi';

function mockResponse(
  body: unknown,
  init?: { ok?: boolean; status?: number }
): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
    clone: () => ({
      arrayBuffer: async () => new ArrayBuffer(0),
    }),
  } as unknown as Response;
}

const fetchMock = jest.fn();

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe('submitUserFeedback', () => {
  it('posts JSON feedback and returns the created id', async () => {
    fetchMock.mockResolvedValue(mockResponse({ id: 'fb-1' }));

    await expect(
      submitUserFeedback(
        { type: 'contact', message: 'Hello', category: 'general' },
        'token'
      )
    ).resolves.toEqual({ id: 'fb-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8081/api/user-feedback',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('uses the server error message when the request fails', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ error: 'Message is too short.' }, { ok: false, status: 400 })
    );

    await expect(
      submitUserFeedback({ type: 'bug', message: 'x' }, 'token')
    ).rejects.toThrow('Message is too short.');
  });

  it('rejects a success response without an id', async () => {
    fetchMock.mockResolvedValue(mockResponse({}));

    await expect(
      submitUserFeedback({ type: 'bug', message: 'It crashed' }, 'token')
    ).rejects.toThrow('Couldn’t send that right now.');
  });

  it('maps an abort to a timeout error', async () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    fetchMock.mockRejectedValue(abort);

    await expect(
      submitUserFeedback({ type: 'feature', message: 'Please add rails' }, 'token')
    ).rejects.toThrow('Sending that timed out.');
  });
});
