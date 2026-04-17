import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from '../../entities/notification.entity';

export interface CreateNotificationData {
  recipientId: string;
  type: string;
  title: string;
  body: string;
  senderId?: string;
  resourceType?: string;
  resourceId?: string;
  actionUrl?: string;
}

interface PendingNotification {
  data: CreateNotificationData;
  timeout: NodeJS.Timeout;
  count: number;
}

@Injectable()
export class NotificationService {
  private pendingNotifications: Map<string, PendingNotification> = new Map();
  private readonly DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @Inject(getRepositoryToken(Notification))
    private readonly notificationRepo: Repository<Notification>
  ) {}

  private getNotificationKey(data: CreateNotificationData): string {
    return `${data.recipientId}:${data.type}:${data.resourceType || ''}:${
      data.resourceId || ''
    }`;
  }

  async queueNotification(data: CreateNotificationData): Promise<void> {
    const key = this.getNotificationKey(data);

    if (this.pendingNotifications.has(key)) {
      const pending = this.pendingNotifications.get(key)!;
      clearTimeout(pending.timeout);
      pending.count++;

      pending.timeout = setTimeout(async () => {
        await this.flushNotification(key);
      }, this.DEBOUNCE_MS);
    } else {
      const timeout = setTimeout(async () => {
        await this.flushNotification(key);
      }, this.DEBOUNCE_MS);

      this.pendingNotifications.set(key, {
        data,
        timeout,
        count: 1,
      });
    }
  }

  private async flushNotification(key: string): Promise<void> {
    const pending = this.pendingNotifications.get(key);
    if (!pending) return;

    const { data, count } = pending;
    this.pendingNotifications.delete(key);

    let body = data.body;
    if (count > 1) {
      const originalBody = data.body
        .replace(/^(Someone|A user) /, '')
        .replace(/^(liked|commented on|followed) /, '');
      body = `You have ${count} new notifications: ${originalBody}`;
    }

    try {
      await this.create({
        ...data,
        body,
      });
    } catch (err) {
      console.error('Failed to create notification:', err);
    }
  }

  async create(data: CreateNotificationData): Promise<Notification> {
    const notification = this.notificationRepo.create({
      ...data,
      type: data.type as NotificationType,
    });
    return await this.notificationRepo.save(notification);
  }

  async findByRecipient(recipientId: string): Promise<Notification[]> {
    return await this.notificationRepo.find({
      where: { recipientId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Notification | null> {
    return await this.notificationRepo.findOne({ where: { id } });
  }

  async markAsRead(id: string): Promise<void> {
    await this.notificationRepo.update(id, { isRead: true });
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    await this.notificationRepo.update(
      { recipientId, isRead: false },
      { isRead: true }
    );
  }

  async delete(id: string): Promise<void> {
    await this.notificationRepo.delete(id);
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    return await this.notificationRepo.count({
      where: { recipientId, isRead: false },
    });
  }

  async getUnreadCountByRecipient(
    recipientId: string
  ): Promise<{ count: number }> {
    const count = await this.getUnreadCount(recipientId);
    return { count };
  }
}
