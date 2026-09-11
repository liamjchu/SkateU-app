import { create } from 'zustand';
import { getApiUrl } from '../lib/api';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  parseNotificationPreferences,
  type NotificationPreferences,
} from '../lib/notificationPreferences';

type PreferencesState = {
  preferences: NotificationPreferences;
  loading: boolean;
  error: string | null;
  fetchPreferences: (accessToken: string) => Promise<void>;
  updatePreferences: (
    patch: Partial<NotificationPreferences>,
    accessToken: string
  ) => Promise<NotificationPreferences>;
  reset: () => void;
};

async function readPreferences(response: Response): Promise<NotificationPreferences> {
  const payload: unknown = await response.json().catch(() => null);
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'preferences' in payload
  ) {
    return parseNotificationPreferences(
      (payload as { preferences: unknown }).preferences
    );
  }
  return { ...DEFAULT_NOTIFICATION_PREFERENCES };
}

export const useNotificationPreferencesStore = create<PreferencesState>(
  (set, get) => ({
    preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    loading: false,
    error: null,
    fetchPreferences: async (accessToken) => {
      set({ loading: true, error: null });
      try {
        const response = await fetch(getApiUrl('/api/notification-preferences'), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
          throw new Error('Couldn’t load notification preferences right now.');
        }
        const preferences = await readPreferences(response);
        set({ preferences, loading: false, error: null });
      } catch (error) {
        set({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Couldn’t load notification preferences right now.',
        });
      }
    },
    updatePreferences: async (patch, accessToken) => {
      const previous = get().preferences;
      const optimistic = { ...previous, ...patch };
      set({ preferences: optimistic, error: null });
      try {
        const response = await fetch(getApiUrl('/api/notification-preferences'), {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(patch),
        });
        if (!response.ok) {
          throw new Error('Couldn’t save notification preferences right now.');
        }
        const preferences = await readPreferences(response);
        set({ preferences });
        return preferences;
      } catch (error) {
        set({
          preferences: previous,
          error:
            error instanceof Error
              ? error.message
              : 'Couldn’t save notification preferences right now.',
        });
        throw error;
      }
    },
    reset: () =>
      set({
        preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
        loading: false,
        error: null,
      }),
  })
);
