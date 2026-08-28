import {
  moderateBio,
  parseBioVerdict,
  softenBioModerationReason,
} from '../bioModeration';

const originalEnv = { ...process.env };
const originalFetch = global.fetch;
const fetchMock = jest.fn();

function moderationResponse(content: string | null, status = 200): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    { status }
  );
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  process.env = { ...originalEnv };
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('parseBioVerdict', () => {
  it('canonicalizes an approval', () => {
    expect(
      parseBioVerdict('{"approved":true,"flag":"IRRELEVANT","reason":"ignored"}')
    ).toEqual({ approved: true, flag: 'NONE', reason: '' });
  });

  it('returns a trimmed rejection reason', () => {
    expect(
      parseBioVerdict(
        '{"approved":false,"flag":"INAPPROPRIATE","reason":"  Unsafe.  "}'
      )
    ).toEqual({
      approved: false,
      flag: 'INAPPROPRIATE',
      reason: 'Unsafe.',
    });
  });
});

describe('softenBioModerationReason', () => {
  it('returns deterministic copy for each flag', () => {
    expect(softenBioModerationReason('INAPPROPRIATE')).toBe(
      'Let’s keep this one school-friendly and try again.'
    );
    expect(softenBioModerationReason('IRRELEVANT')).toBe(
      'That reads like spam — try a real bio.'
    );
  });
});

describe('moderateBio', () => {
  it('sends the bio to the provider and canonicalizes an approval', async () => {
    fetchMock.mockResolvedValue(
      moderationResponse('{"approved":true,"flag":"NONE","reason":""}')
    );
    await expect(moderateBio('Skater at State')).resolves.toEqual({
      approved: true,
      flag: 'NONE',
      reason: '',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer test-key' })
    );
    const body = JSON.parse(String(init.body)) as {
      messages: { content: string }[];
    };
    expect(body.messages[1].content).toContain('Skater at State');
  });

  it('fails closed when the key is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(moderateBio('Skater at State')).rejects.toThrow(
      'Bio moderation is unavailable.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the provider errors', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce(moderationResponse('provider secret', 500));
    await expect(moderateBio('Skater at State')).rejects.toThrow(
      'Bio moderation is unavailable.'
    );
    expect(errorSpy).toHaveBeenCalled();
  });

  it('fails closed when the provider returns no content', async () => {
    fetchMock.mockResolvedValueOnce(moderationResponse(null));
    await expect(moderateBio('Skater at State')).rejects.toThrow(
      'Bio moderation is unavailable.'
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [] }), { status: 200 })
    );
    await expect(moderateBio('Skater at State')).rejects.toThrow(
      'Bio moderation is unavailable.'
    );
  });

  it('wraps unexpected fetch failures', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await expect(moderateBio('Skater at State')).rejects.toThrow(
      'Bio moderation is unavailable.'
    );
    expect(errorSpy).toHaveBeenCalled();
  });
});
