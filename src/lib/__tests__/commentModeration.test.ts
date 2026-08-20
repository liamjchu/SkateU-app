import {
    moderateComment,
    parseCommentVerdict,
    softenCommentModerationReason,
} from '../commentModeration';

const originalEnv = { ...process.env };
const originalFetch = global.fetch;
const fetchMock = jest.fn();

function moderationResponse(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
  });
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

describe('parseCommentVerdict', () => {
  it('canonicalizes an approval even if flag/reason are present', () => {
    expect(
      parseCommentVerdict('{"approved":true,"flag":"IRRELEVANT","reason":"ignored"}')
    ).toEqual({ approved: true, flag: 'NONE', reason: '' });
  });

  it('returns a trimmed rejection reason', () => {
    expect(
      parseCommentVerdict(
        '{"approved":false,"flag":"INAPPROPRIATE","reason":"  Unsafe.  "}'
      )
    ).toEqual({ approved: false, flag: 'INAPPROPRIATE', reason: 'Unsafe.' });
  });

  it('rejects malformed payloads', () => {
    expect(() => parseCommentVerdict('not-json')).toThrow(
      'Comment moderation is unavailable.'
    );
    expect(() =>
      parseCommentVerdict('{"approved":false,"flag":"NONE","reason":""}')
    ).toThrow('Comment moderation is unavailable.');
  });
});

describe('moderateComment', () => {
  it('sends the comment to the provider and canonicalizes an approval', async () => {
    fetchMock.mockResolvedValue(
      moderationResponse('{"approved":true,"flag":"NONE","reason":""}')
    );
    await expect(moderateComment('Sick ledge')).resolves.toEqual({
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
      response_format: { type: string };
      messages: { content: string }[];
    };
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[1].content).toContain('Sick ledge');
  });

  it('fails closed when the key is missing or the provider errors', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    delete process.env.OPENAI_API_KEY;
    await expect(moderateComment('Sick ledge')).rejects.toThrow(
      'Comment moderation is unavailable.'
    );
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.OPENAI_API_KEY = 'test-key';
    fetchMock.mockResolvedValueOnce(moderationResponse('provider secret', 500));
    await expect(moderateComment('Sick ledge')).rejects.toThrow(
      'Comment moderation is unavailable.'
    );
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('softenCommentModerationReason', () => {
  it('returns deterministic copy that does not repeat the model reason', () => {
    expect(softenCommentModerationReason('INAPPROPRIATE')).toBe(
      'Let’s keep this one school-friendly and try again.'
    );
    expect(softenCommentModerationReason('IRRELEVANT')).toBe(
      'That doesn’t really work as a comment — try saying something about the spot.'
    );
  });
});
