import { create } from 'zustand';

export const AUTH_NOTICE_SIGNED_IN_TITLE = 'Logged in';
export const AUTH_NOTICE_SIGNED_IN_MESSAGE = "You're logged in.";
export const AUTH_NOTICE_FAILED_TITLE = "Couldn't finish logging in";
export const AUTH_NOTICE_FAILED_FALLBACK =
  'Check your connection and try again.';

export type AuthNoticeKind = 'success' | 'error';

export type AuthNotice = {
  kind: AuthNoticeKind;
  title: string;
  message: string;
};

type AuthNoticeState = {
  notice: AuthNotice | null;
  showAuthNotice: (
    input:
      | { kind: 'success' }
      | { kind: 'error'; message?: string }
  ) => void;
  clearAuthNotice: () => void;
};

export const useAuthNoticeStore = create<AuthNoticeState>((set) => ({
  notice: null,
  showAuthNotice: (input) => {
    if (input.kind === 'success') {
      set({
        notice: {
          kind: 'success',
          title: AUTH_NOTICE_SIGNED_IN_TITLE,
          message: AUTH_NOTICE_SIGNED_IN_MESSAGE,
        },
      });
      return;
    }

    set({
      notice: {
        kind: 'error',
        title: AUTH_NOTICE_FAILED_TITLE,
        message: input.message?.trim() || AUTH_NOTICE_FAILED_FALLBACK,
      },
    });
  },
  clearAuthNotice: () => set({ notice: null }),
}));
