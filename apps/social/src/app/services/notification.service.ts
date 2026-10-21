import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  notificationTemplate,
  projectNotification,
  SafeNotification,
} from '@optimistic-tanuki/social-contracts';
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
  [key: string]: unknown;
}

interface PendingNotification {
  data: CreateNotificationData;
  timeout: NodeJS.Timeout;
  count: number;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class NotificationService {
  private pendingNotifications: Map<string, PendingNotification> = new Map();
  private readonly DEBOUNCE_MS = 5 * 60 * 1000;

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
    const pending = this.pendingNotifications.get(key);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.count++;
      pending.timeout = setTimeout(
        async () => this.flushNotification(key),
        this.DEBOUNCE_MS
      );
    } else {
      const timeout = setTimeout(
        async () => this.flushNotification(key),
        this.DEBOUNCE_MS
      );
      this.pendingNotifications.set(key, { data, timeout, count: 1 });
    }
  }

  private async flushNotification(key: string): Promise<void> {
    const pending = this.pendingNotifications.get(key);
    if (!pending) return;
    this.pendingNotifications.delete(key);
    try {
      await this.create(pending.data);
    } catch (err) {
      console.error('Failed to create notification:', err);
    }
  }

  async create(data: CreateNotificationData): Promise<SafeNotification> {
    const recipientId = this.canonicalUuid(data?.recipientId);
    if (!recipientId || !this.isKnownType(data?.type)) {
      throw this.badRequest('Notification recipient or type is invalid');
    }
    const template = notificationTemplate(data.type);
    const notification = this.notificationRepo.create({
      recipientId,
      type: data.type as NotificationType,
      title: template.title,
      body: template.body,
    });
    const saved = await this.notificationRepo.save(notification);
    const projected = projectNotification(saved);
    if (!projected) throw this.badRequest('Stored notification is malformed');
    return projected;
  }

  async findByRecipient(recipientId: string): Promise<SafeNotification[]> {
    const canonicalRecipientId = this.requireUuid(recipientId);
    const rows = await this.notificationRepo.find({
      where: { recipientId: canonicalRecipientId },
      order: { createdAt: 'DESC' },
    });
    return rows
      .map(projectNotification)
      .filter((row): row is SafeNotification => row !== null);
  }

  async findOne(id: string): Promise<SafeNotification | null> {
    const canonicalId = this.requireUuid(id);
    const row = await this.notificationRepo.findOne({
      where: { id: canonicalId },
    });
    return row ? projectNotification(row) : null;
  }

  async markAsRead(id: string, recipientId: string): Promise<void> {
    const identity = this.mutationIdentity(id, recipientId);
    const result = await this.notificationRepo.update(identity, {
      isRead: true,
    });
    this.assertMutationMatched(result.affected);
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    const canonicalRecipientId = this.requireUuid(recipientId);
    await this.notificationRepo.update(
      { recipientId: canonicalRecipientId, isRead: false },
      { isRead: true }
    );
  }

  async delete(id: string, recipientId: string): Promise<void> {
    const identity = this.mutationIdentity(id, recipientId);
    const result = await this.notificationRepo.delete(identity);
    this.assertMutationMatched(result.affected);
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    const canonicalRecipientId = this.requireUuid(recipientId);
    return this.notificationRepo.count({
      where: { recipientId: canonicalRecipientId, isRead: false },
    });
  }

  async getUnreadCountByRecipient(
    recipientId: string
  ): Promise<{ count: number }> {
    return { count: await this.getUnreadCount(recipientId) };
  }

  private mutationIdentity(
    id: string,
    recipientId: string
  ): { id: string; recipientId: string } {
    return {
      id: this.requireUuid(id),
      recipientId: this.requireUuid(recipientId),
    };
  }

  private canonicalUuid(value: unknown): string | null {
    return typeof value === 'string' && UUID_PATTERN.test(value)
      ? value.toLowerCase()
      : null;
  }

  private requireUuid(value: string): string {
    const canonical = this.canonicalUuid(value);
    if (!canonical) throw this.badRequest('Notification identity is invalid');
    return canonical;
  }

  private isKnownType(type: unknown): type is NotificationType {
    return (
      typeof type === 'string' &&
      Object.values(NotificationType).includes(type as NotificationType)
    );
  }

  private badRequest(message: string): RpcException {
    return new RpcException({ statusCode: 400, message });
  }

  private assertMutationMatched(affected: number | undefined): void {
    if (!affected)
      throw new RpcException({
        statusCode: 404,
        message: 'Notification not found',
      });
  }
}
