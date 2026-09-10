import {
  NOTIFICATION_TYPES,
  type NotificationType,
  type UserNotification,
} from '../types/notification';
import { isRecord } from './readCache';
import { parseXpRank } from './xpRank';

const FALLBACK_ACTOR = 'Someone';
const UNREAD_BADGE_CAP = 9;

export function parseNotificationType(value: unknown): NotificationType | null {
  if (typeof value !== 'string') {
    return null;
  }
  return NOTIFICATION_TYPES.includes(value as NotificationType)
    ? (value as NotificationType)
    : null;
}

function quotedSpotName(spotName: string | null | undefined): string {
  const name = spotName?.trim();
  return name ? ` “${name}”` : '';
}

function actorLabel(username: string | null | undefined): string {
  const name = username?.trim();
  return name && name.length > 0 ? name : FALLBACK_ACTOR;
}

export function formatNotificationBody(input: {
  type: NotificationType;
  actorUsername: string | null;
  spotName: string | null;
}): string {
  const actor = actorLabel(input.actorUsername);
  const spot = quotedSpotName(input.spotName);

  switch (input.type) {
    case 'spot_like':
      return `${actor} liked your spot${spot || ''}`;
    case 'spot_comment':
      return `${actor} commented on${spot || ' your spot'}`;
    case 'comment_reply':
      return `${actor} replied to your comment`;
    case 'follow':
      return `${actor} started following you`;
  }
}

export function formatUnreadBadge(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }
  if (count > UNREAD_BADGE_CAP) {
    return `${UNREAD_BADGE_CAP}+`;
  }
  return String(Math.floor(count));
}

export function formatNotificationsA11yLabel(unreadCount: number): string {
  const badge = formatUnreadBadge(unreadCount);
  if (!badge) {
    return 'Notifications';
  }
  if (badge === `${UNREAD_BADGE_CAP}+`) {
    return `Notifications, more than ${UNREAD_BADGE_CAP} unread`;
  }
  if (badge === '1') {
    return 'Notifications, 1 unread';
  }
  return `Notifications, ${badge} unread`;
}

export type NotificationRoute =
  | { kind: 'comments'; spotId: string; spotName: string }
  | { kind: 'profile'; userId: string }
  | { kind: 'none' };

export function notificationRoute(
  notification: Pick<
    UserNotification,
    'type' | 'actorId' | 'spotId' | 'spotName'
  >
): NotificationRoute {
  if (notification.type === 'follow') {
    if (!notification.actorId) {
      return { kind: 'none' };
    }
    return { kind: 'profile', userId: notification.actorId };
  }

  if (!notification.spotId) {
    return { kind: 'none' };
  }

  return {
    kind: 'comments',
    spotId: notification.spotId,
    spotName: notification.spotName?.trim() ?? '',
  };
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function parseUnreadCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

export function mapNotificationView(value: unknown): UserNotification | null {
  if (!isRecord(value)) {
    return null;
  }
  const type = parseNotificationType(value.type);
  const id = readOptionalString(value.id);
  const body = readOptionalString(value.body);
  if (!type || !id || !body) {
    return null;
  }

  const actorRank = parseXpRank(value.actorRank);

  return {
    id,
    type,
    body,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    readAt: typeof value.readAt === 'string' ? value.readAt : null,
    actorId: readOptionalString(value.actorId),
    actorUsername: readOptionalString(value.actorUsername),
    actorAvatarUrl: readOptionalString(value.actorAvatarUrl),
    ...(actorRank ? { actorRank } : {}),
    spotId: readOptionalString(value.spotId),
    spotName: readOptionalString(value.spotName),
    spotImageUrl: readOptionalString(value.spotImageUrl),
  };
}
