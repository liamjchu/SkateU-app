import {
  NOTIFICATION_TYPES,
  type NotificationType,
  type UserNotification,
} from '../types/notification';
import { isRecord } from './readCache';
import {
  parseXpRank,
  XP_PER_APPROVED_SPOT,
  XP_PER_COMMENT_RECEIVED,
  XP_PER_LIKE_RECEIVED,
} from './xpRank';

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

function actorLabel(
  type: NotificationType,
  username: string | null | undefined
): string {
  if (
    type === 'spot_approved' ||
    type === 'spot_uploaded' ||
    type === 'spot_under_review' ||
    type === 'spot_removed'
  ) {
    return 'Your spot';
  }
  const name = username?.trim();
  return name && name.length > 0 ? name : FALLBACK_ACTOR;
}

export function notificationCopy(input: {
  type: NotificationType;
  actorUsername: string | null;
  spotName: string | null;
  schoolName?: string | null;
}): { actor: string; rest: string } {
  const actor = actorLabel(input.type, input.actorUsername);
  const spot = quotedSpotName(input.spotName);
  const school = input.schoolName?.trim();

  switch (input.type) {
    case 'spot_like':
      return { actor, rest: `liked your spot${spot || ''}` };
    case 'spot_comment':
      return { actor, rest: `commented on${spot || ' your spot'}` };
    case 'comment_reply':
      return { actor, rest: 'replied to your comment' };
    case 'follow':
      return { actor, rest: 'started following you' };
    case 'saved_school_spot':
      if (school) {
        return {
          actor,
          rest: `added a new spot${spot || ''} at ${school}`,
        };
      }
      return {
        actor,
        rest: `added a new spot${spot || ''} at a school you saved`,
      };
    case 'liked_spot_comment':
      return { actor, rest: `commented on${spot || ' a spot you liked'}` };
    case 'spot_approved':
      return { actor, rest: `${spot ? `${spot.trim()} ` : ''}is live`.trim() };
    case 'spot_uploaded':
      return {
        actor,
        rest: `${spot ? `${spot.trim()} ` : ''}was uploaded`.trim(),
      };
    case 'spot_under_review':
      return {
        actor,
        rest: `${spot ? `${spot.trim()} ` : ''}is under review`.trim(),
      };
    case 'spot_removed':
      return { actor, rest: `${spot ? `${spot.trim()} ` : ''}was removed`.trim() };
  }
}

export function formatNotificationBody(input: {
  type: NotificationType;
  actorUsername: string | null;
  spotName: string | null;
  schoolName?: string | null;
}): string {
  const { actor, rest } = notificationCopy(input);
  return `${actor} ${rest}`;
}

export function notificationXpDelta(type: NotificationType): number | null {
  switch (type) {
    case 'spot_like':
      return XP_PER_LIKE_RECEIVED;
    case 'spot_comment':
      return XP_PER_COMMENT_RECEIVED;
    case 'spot_approved':
      return XP_PER_APPROVED_SPOT;
    default:
      return null;
  }
}

export function formatXpDeltaLabel(delta: number): string {
  return `+${Math.max(0, Math.floor(delta))} XP`;
}

export function formatNotificationPushBody(input: {
  type: NotificationType;
  actorUsername: string | null;
  spotName: string | null;
  schoolName?: string | null;
}): string {
  const body = formatNotificationBody(input);
  const xp = notificationXpDelta(input.type);
  if (xp == null) {
    return body;
  }
  return `${body} · ${formatXpDeltaLabel(xp)}`;
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

  if (notification.type === 'spot_removed' || !notification.spotId) {
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
    schoolName: readOptionalString(value.schoolName),
    spotImageUrl: readOptionalString(value.spotImageUrl),
  };
}
