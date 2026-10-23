import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
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
export class NotificationService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private stopping = false;
  private readonly cancellingRecipients = new Set<string>();
  private readonly activeWrites = new Map<string, Set<Promise<unknown>>>();
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
    const recipientId = this.requireUuid(data?.recipientId);
    if (!this.isKnownType(data?.type))
      throw this.badRequest('Notification type is invalid');
    this.assertAcceptingWork(recipientId);
    const template = notificationTemplate(data.type);
    // Keep only the typed event and bounded grouping references in this volatile queue.
    // Caller-authored text, sender IDs and URLs must never remain in pending work.
    data = {
      recipientId,
      type: data.type,
      title: template.title,
      body: template.body,
      resourceType:
        typeof data.resourceType === 'string'
          ? data.resourceType.slice(0, 128)
          : undefined,
      resourceId:
        typeof data.resourceId === 'string'
          ? data.resourceId.slice(0, 255)
          : undefined,
    };
    const key = this.getNotificationKey(data);
    const pending = this.pendingNotifications.get(key);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.count++;
      pending.timeout = setTimeout(
        () => void this.flushNotification(key),
        this.DEBOUNCE_MS
      );
    } else {
      const timeout = setTimeout(
        () => void this.flushNotification(key),
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
      this.logger.warn('Queued notification write failed');
    }
  }

  async create(data: CreateNotificationData): Promise<SafeNotification> {
    const recipientId = this.canonicalUuid(data?.recipientId);
    if (!recipientId || !this.isKnownType(data?.type)) {
      throw this.badRequest('Notification recipient or type is invalid');
    }
    this.assertAcceptingWork(recipientId);
    const work = this.persistNotification(data, recipientId);
    let writes = this.activeWrites.get(recipientId);
    if (!writes) {
      writes = new Set();
      this.activeWrites.set(recipientId, writes);
    }
    writes.add(work);
    try {
      return await work;
    } finally {
      writes.delete(work);
      if (!writes.size) this.activeWrites.delete(recipientId);
    }
  }

  private async persistNotification(
    data: CreateNotificationData,
    recipientId: string
  ): Promise<SafeNotification> {
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

  /** Internal batch cancellation; D00 owns the durable account-wide producer fence. */
  async cancelPendingForRecipient(
    recipientId: string
  ): Promise<{ cancelledPending: number; drainedWrites: number }> {
    const canonical = this.requireUuid(recipientId);
    if (this.cancellingRecipients.has(canonical))
      throw this.badRequest('Notification cancellation already in progress');
    this.cancellingRecipients.add(canonical);
    let cancelledPending = 0;
    try {
      for (const [key, pending] of this.pendingNotifications) {
        if (pending.data.recipientId !== canonical) continue;
        clearTimeout(pending.timeout);
        this.pendingNotifications.delete(key);
        cancelledPending++;
      }
      const writes = [...(this.activeWrites.get(canonical) ?? [])];
      await Promise.allSettled(writes);
      return { cancelledPending, drainedWrites: writes.length };
    } finally {
      this.cancellingRecipients.delete(canonical);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    for (const pending of this.pendingNotifications.values())
      clearTimeout(pending.timeout);
    this.pendingNotifications.clear();
    await Promise.allSettled(
      [...this.activeWrites.values()].flatMap((writes) => [...writes])
    );
  }

  private assertAcceptingWork(recipientId: string): void {
    if (this.stopping || this.cancellingRecipients.has(recipientId))
      throw this.badRequest('Notification work is stopped');
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
