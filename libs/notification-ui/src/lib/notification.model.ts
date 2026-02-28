export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'mention'
  | 'message'
  | 'community_invite'
  | 'system';

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  resourceType?: string;
  resourceId?: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: Date;
}

export interface CreateNotificationDto {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  senderId?: string;
  resourceType?: string;
  resourceId?: string;
  actionUrl?: string;
}
