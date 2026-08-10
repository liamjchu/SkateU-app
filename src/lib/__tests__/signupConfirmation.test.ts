import {
    RESEND_SIGNUP_COOLDOWN_SECONDS,
    resendSignupConfirmation,
} from '../signupConfirmation';

const originalEnv = { ...process.env };

function jsonResponse(body: unknown, status = 202): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('resendSignupConfirmation', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.co/';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-key';
  });

  it('calls only the protected Edge Function and uses its cooldown', async () => {
    const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    fetchMock.mockResolvedValue(jsonResponse({ retryAfterSeconds: 47 }));

    await expect(
      resendSignupConfirmation('  skater@example.edu  ', fetchMock)
    ).resolves.toEqual({ retryAfterSeconds: 47 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/resend-signup-confirmation',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'skater@example.edu' }),
        headers: expect.objectContaining({
          apikey: 'public-anon-key',
          Authorization: 'Bearer public-anon-key',
        }),
      })
    );
  });

  it('uses the safe default when the server response is malformed', async () => {
    const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    fetchMock.mockResolvedValue(jsonResponse({ retryAfterSeconds: 0 }));

    await expect(resendSignupConfirmation('skater@example.edu', fetchMock)).resolves.toEqual({
      retryAfterSeconds: RESEND_SIGNUP_COOLDOWN_SECONDS,
    });
  });

  it('does not make a network request for a blank email', async () => {
    const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

    await expect(resendSignupConfirmation('   ', fetchMock)).rejects.toThrow(
      'Enter an email address'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not expose server response details when a request fails', async () => {
    const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    fetchMock.mockResolvedValue(jsonResponse({ error: 'account confirmed' }, 503));

    await expect(resendSignupConfirmation('skater@example.edu', fetchMock)).rejects.toThrow(
      'Could not request another code. Try again shortly.'
    );
  });
});
