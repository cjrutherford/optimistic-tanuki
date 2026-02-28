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

@Injectable()
export class NotificationService {
  constructor(
    @Inject(getRepositoryToken(Notification))
    private readonly notificationRepo: Repository<Notification>
  ) {}

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
