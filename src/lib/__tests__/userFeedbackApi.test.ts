import { buildUserFeedbackRequest } from '../userFeedbackApi';

describe('buildUserFeedbackRequest', () => {
  it('sends JSON when there is no screenshot', () => {
    const request = buildUserFeedbackRequest({
      type: 'contact',
      category: 'general',
      message: 'Hello',
      email: 'skater@example.com',
    });

    expect(request.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(request.body))).toEqual({
      type: 'contact',
      category: 'general',
      message: 'Hello',
      email: 'skater@example.com',
    });
  });

  it('uses multipart when a screenshot is attached', () => {
    const request = buildUserFeedbackRequest({
      type: 'bug',
      message: 'It crashed',
      screenshot: {
        uri: 'file:///tmp/bug.jpg',
        fileName: 'bug.jpg',
        mimeType: 'image/jpeg',
      },
    });

    expect(request.headers).toEqual({});
    expect(request.body).toBeInstanceOf(FormData);
  });
});
