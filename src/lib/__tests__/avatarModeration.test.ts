import {
  moderateAvatarImage,
  softenAvatarModerationReason,
} from '../avatarModeration';

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

describe('moderateAvatarImage', () => {
  it('sends the photo URL and canonicalizes an approval', async () => {
    fetchMock.mockResolvedValue(
      moderationResponse('{"approved":true,"reason":"ignored"}')
    );
    await expect(
      moderateAvatarImage('https://project.supabase.co/storage/v1/object/public/avatars/a.jpg')
    ).resolves.toEqual({ approved: true, reason: '' });
  });

  it('fails closed when the provider is unavailable', async () => {
    fetchMock.mockResolvedValue(moderationResponse('not-json', 500));
    await expect(
      moderateAvatarImage('https://project.supabase.co/storage/v1/object/public/avatars/a.jpg')
    ).rejects.toThrow('Avatar moderation is unavailable.');
  });
});

describe('softenAvatarModerationReason', () => {
  it('keeps a short gentle reason and rewrites harsh copy', () => {
    expect(softenAvatarModerationReason('Let’s try a different photo.')).toBe(
      'Let’s try a different photo.'
    );
    expect(softenAvatarModerationReason('This is inappropriate and not allowed.')).toBe(
      'Let’s try a different photo.'
    );
  });
});
