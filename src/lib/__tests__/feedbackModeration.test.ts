import {
  FEEDBACK_SAFETY_REJECT_MESSAGE,
  moderateFeedbackSubmission,
  shouldBlockFeedbackCategories,
} from '../feedbackModeration';

const originalEnv = { ...process.env };
const originalFetch = global.fetch;
const fetchMock = jest.fn();

function moderationResponse(
  categories: Record<string, boolean>,
  status = 200
): Response {
  return new Response(JSON.stringify({ results: [{ categories }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
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

describe('shouldBlockFeedbackCategories', () => {
  it('ignores empty or missing categories', () => {
    expect(shouldBlockFeedbackCategories(undefined)).toBe(false);
    expect(shouldBlockFeedbackCategories({})).toBe(false);
  });

  it('blocks sexual content, threats, and graphic violence', () => {
    expect(shouldBlockFeedbackCategories({ sexual: true })).toBe(true);
    expect(shouldBlockFeedbackCategories({ 'sexual/minors': true })).toBe(true);
    expect(
      shouldBlockFeedbackCategories({ 'harassment/threatening': true })
    ).toBe(true);
    expect(shouldBlockFeedbackCategories({ 'hate/threatening': true })).toBe(
      true
    );
    expect(shouldBlockFeedbackCategories({ 'violence/graphic': true })).toBe(
      true
    );
  });

  it('allows angry or rude mail that is not a threat or sexual', () => {
    expect(
      shouldBlockFeedbackCategories({
        harassment: true,
        hate: true,
        violence: true,
      })
    ).toBe(false);
  });
});

describe('moderateFeedbackSubmission', () => {
  it('skips the provider when no API key is configured', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(
      moderateFeedbackSubmission({ message: 'The pin vanished' })
    ).resolves.toEqual({ allowed: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the message to the moderations API and allows ordinary mail', async () => {
    fetchMock.mockResolvedValue(moderationResponse({ harassment: true }));
    await expect(
      moderateFeedbackSubmission({ message: 'The pin vanished' })
    ).resolves.toEqual({ allowed: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/moderations');
    expect(init.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer test-key' })
    );
    const body = JSON.parse(String(init.body)) as {
      model: string;
      input: { type: string; text?: string }[];
    };
    expect(body.model).toBe('omni-moderation-latest');
    expect(body.input).toEqual([
      { type: 'text', text: 'The pin vanished' },
    ]);
  });

  it('includes a screenshot when one is attached', async () => {
    fetchMock.mockResolvedValue(moderationResponse({}));
    await moderateFeedbackSubmission({
      message: 'It crashed',
      imageDataUrl: 'data:image/jpeg;base64,AAA',
    });
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)
    ) as {
      input: { type: string; image_url?: { url: string } }[];
    };
    expect(body.input).toEqual([
      { type: 'text', text: 'It crashed' },
      {
        type: 'image_url',
        image_url: { url: 'data:image/jpeg;base64,AAA' },
      },
    ]);
  });

  it('rejects a message flagged for sexual content', async () => {
    fetchMock.mockResolvedValue(moderationResponse({ sexual: true }));
    await expect(
      moderateFeedbackSubmission({ message: 'flagged payload' })
    ).resolves.toEqual({
      allowed: false,
      message: FEEDBACK_SAFETY_REJECT_MESSAGE,
    });
  });

  it('fails open when the provider errors', async () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    fetchMock.mockResolvedValue(moderationResponse({}, 500));
    await expect(
      moderateFeedbackSubmission({ message: 'The pin vanished' })
    ).resolves.toEqual({ allowed: true });
    expect(errorSpy).toHaveBeenCalled();
  });
});
