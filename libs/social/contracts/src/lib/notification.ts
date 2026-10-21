export type SafeNotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'mention'
  | 'message'
  | 'community_invite'
  | 'system';

export interface SafeNotification {
  id: string;
  recipientId: string;
  type: SafeNotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TEMPLATES: Record<SafeNotificationType, { title: string; body: string }> =
  {
    like: { title: 'New like', body: 'Someone liked your post' },
    comment: { title: 'New comment', body: 'Someone commented on your post' },
    follow: { title: 'New follower', body: 'Someone followed you' },
    mention: {
      title: 'You were mentioned',
      body: 'Someone mentioned you in a post',
    },
    message: { title: 'New message', body: 'You have a new message' },
    community_invite: {
      title: 'Community invitation',
      body: 'You have a new community invitation',
    },
    system: { title: 'Notification', body: 'You have a new notification' },
  };

const TYPES = new Set<string>(Object.keys(TEMPLATES));

export function notificationTemplate(type: unknown): {
  title: string;
  body: string;
} {
  return TEMPLATES[
    typeof type === 'string' && TYPES.has(type)
      ? (type as SafeNotificationType)
      : 'system'
  ];
}

function canonicalUuid(value: unknown): string | null {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) return null;
  return value.toLowerCase();
}

export function projectNotification(input: unknown): SafeNotification | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  const id = canonicalUuid(row['id']);
  const recipientId = canonicalUuid(row['recipientId']);
  const rawCreatedAt = row['createdAt'];
  const createdAt =
    rawCreatedAt instanceof Date && !Number.isNaN(rawCreatedAt.getTime())
      ? rawCreatedAt.toISOString()
      : typeof rawCreatedAt === 'string' &&
        !Number.isNaN(Date.parse(rawCreatedAt))
      ? new Date(rawCreatedAt).toISOString()
      : null;
  if (!id || !recipientId || typeof row['isRead'] !== 'boolean' || !createdAt)
    return null;

  const type: SafeNotificationType =
    typeof row['type'] === 'string' && TYPES.has(row['type'])
      ? (row['type'] as SafeNotificationType)
      : 'system';
  const { title, body } = notificationTemplate(type);
  return {
    id,
    recipientId,
    type,
    title,
    body,
    isRead: row['isRead'],
    createdAt,
  };
}
