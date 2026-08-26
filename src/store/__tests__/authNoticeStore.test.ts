import {
  AUTH_NOTICE_FAILED_FALLBACK,
  AUTH_NOTICE_FAILED_TITLE,
  AUTH_NOTICE_SIGNED_IN_MESSAGE,
  AUTH_NOTICE_SIGNED_IN_TITLE,
  useAuthNoticeStore,
} from '../authNoticeStore';

beforeEach(() => {
  useAuthNoticeStore.setState({ notice: null });
});

describe('authNoticeStore', () => {
  it('shows a signed-in notice', () => {
    useAuthNoticeStore.getState().showAuthNotice({ kind: 'success' });
    expect(useAuthNoticeStore.getState().notice).toEqual({
      kind: 'success',
      title: AUTH_NOTICE_SIGNED_IN_TITLE,
      message: AUTH_NOTICE_SIGNED_IN_MESSAGE,
    });
  });

  it('shows a connection error notice and can clear it', () => {
    useAuthNoticeStore.getState().showAuthNotice({
      kind: 'error',
      message: 'Check your connection and try again.',
    });
    expect(useAuthNoticeStore.getState().notice).toEqual({
      kind: 'error',
      title: AUTH_NOTICE_FAILED_TITLE,
      message: 'Check your connection and try again.',
    });

    useAuthNoticeStore.getState().clearAuthNotice();
    expect(useAuthNoticeStore.getState().notice).toBeNull();
  });

  it('falls back when an error has no message', () => {
    useAuthNoticeStore.getState().showAuthNotice({ kind: 'error' });
    expect(useAuthNoticeStore.getState().notice?.message).toBe(
      AUTH_NOTICE_FAILED_FALLBACK
    );
  });
});
