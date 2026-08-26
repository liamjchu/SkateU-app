import {
    imageFileToDataUrl,
    moderateSpotSubmission,
    softenModerationReason,
} from '../spotModeration';

const originalEnv = { ...process.env };
const originalFetch = global.fetch;
const fetchMock = jest.fn();
const submission = { title: 'Library ledge', description: 'Waxed brick ledge', imageUrls: ['data:image/png;base64,AAA'] };

function moderationResponse(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
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

describe('imageFileToDataUrl', () => {
  it('encodes files larger than the internal chunk size without losing bytes', async () => {
    const bytes = new Uint8Array(32_769);
    await expect(imageFileToDataUrl({ type: 'image/png', arrayBuffer: async () => bytes.buffer })).resolves.toBe(`data:image/png;base64,${'A'.repeat(43_692)}`);
  });
});

describe('moderateSpotSubmission', () => {
  it('sends the submission to the provider and canonicalizes an approval', async () => {
    fetchMock.mockResolvedValue(moderationResponse('{"approved":true,"flag":"IRRELEVANT","reason":"ignored"}'));
    await expect(moderateSpotSubmission(submission)).resolves.toEqual({ approved: true, flag: 'NONE', reason: '' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer test-key' }));
    const body = JSON.parse(String(init.body)) as { response_format: { type: string }; messages: { role: string; content: unknown }[] };
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0]).toEqual(
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('Almost ignore the title and description'),
      })
    );
    expect(body.messages[1].content).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'image_url' })]));
  });

  it('returns a trimmed rejection reason from a valid rejected verdict', async () => {
    fetchMock.mockResolvedValue(moderationResponse('{"approved":false,"flag":"INAPPROPRIATE","reason":"  Unsafe content.  "}'));
    await expect(moderateSpotSubmission(submission)).resolves.toEqual({ approved: false, flag: 'INAPPROPRIATE', reason: 'Unsafe content.' });
  });

  it('rejects unavailable, failed, and malformed moderation responses without leaking provider details', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    delete process.env.OPENAI_API_KEY;
    await expect(moderateSpotSubmission(submission)).rejects.toThrow('Spot moderation is unavailable.');
    expect(fetchMock).not.toHaveBeenCalled();
    process.env.OPENAI_API_KEY = 'test-key';
    fetchMock.mockResolvedValueOnce(moderationResponse('provider secret', 500)).mockResolvedValueOnce(moderationResponse('{"approved":false,"flag":"NONE","reason":""}'));
    await expect(moderateSpotSubmission(submission)).rejects.toThrow('Spot moderation is unavailable.');
    await expect(moderateSpotSubmission(submission)).rejects.toThrow('Spot moderation is unavailable.');
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('softenModerationReason', () => {
  it('always returns deterministic field-specific copy', () => {
    expect(
      softenModerationReason('IRRELEVANT', 'That name doesn’t really say what the spot is.')
    ).toBe('That name doesn’t really say what the spot is — try the obstacle or where it is.');
    expect(
      softenModerationReason('INAPPROPRIATE', 'This title is inappropriate and not allowed.')
    ).toBe('Let’s keep the name school-friendly — tweak it and try again.');
    expect(
      softenModerationReason('IRRELEVANT', 'The description is prohibited spam.')
    ).toBe(
      'The description’s a little thin — a line about the ledge, rail, or run-up would help.'
    );
  });
});
