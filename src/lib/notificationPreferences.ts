import type { NotificationType } from '../types/notification';

export type NotificationPreferences = {
  pushEnabled: boolean;
  notifySocial: boolean;
  notifyCampus: boolean;
  notifySpotUpdates: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  notifySocial: true,
  notifyCampus: true,
  notifySpotUpdates: true,
};

const SOCIAL_TYPES: NotificationType[] = [
  'spot_like',
  'spot_comment',
  'comment_reply',
  'follow',
];

const CAMPUS_TYPES: NotificationType[] = [
  'saved_school_spot',
  'liked_spot_comment',
];

const SPOT_UPDATE_TYPES: NotificationType[] = [
  'spot_approved',
  'spot_uploaded',
  'spot_under_review',
  'spot_removed',
];

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function parseNotificationPreferences(
  value: unknown
): NotificationPreferences {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  const record = value as Record<string, unknown>;
  return {
    pushEnabled: readBoolean(
      record.pushEnabled,
      DEFAULT_NOTIFICATION_PREFERENCES.pushEnabled
    ),
    notifySocial: readBoolean(
      record.notifySocial,
      DEFAULT_NOTIFICATION_PREFERENCES.notifySocial
    ),
    notifyCampus: readBoolean(
      record.notifyCampus,
      DEFAULT_NOTIFICATION_PREFERENCES.notifyCampus
    ),
    notifySpotUpdates: readBoolean(
      record.notifySpotUpdates,
      DEFAULT_NOTIFICATION_PREFERENCES.notifySpotUpdates
    ),
  };
}

export function mapProfileNotificationPreferences(row: {
  push_enabled?: unknown;
  notify_social?: unknown;
  notify_campus?: unknown;
  notify_spot_updates?: unknown;
}): NotificationPreferences {
  return parseNotificationPreferences({
    pushEnabled: row.push_enabled,
    notifySocial: row.notify_social,
    notifyCampus: row.notify_campus,
    notifySpotUpdates: row.notify_spot_updates,
  });
}

export function preferenceAllowsPush(
  type: NotificationType,
  prefs: NotificationPreferences
): boolean {
  if (!prefs.pushEnabled) {
    return false;
  }
  if (SOCIAL_TYPES.includes(type)) {
    return prefs.notifySocial;
  }
  if (CAMPUS_TYPES.includes(type)) {
    return prefs.notifyCampus;
  }
  if (SPOT_UPDATE_TYPES.includes(type)) {
    return prefs.notifySpotUpdates;
  }
  return false;
}
