import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity, ActivityType } from '../../entities/activity.entity';
import { SavedItem } from '../../entities/saved-item.entity';

export interface CreateActivityData {
  profileId: string;
  type: ActivityType;
  description: string;
  resourceId?: string;
  resourceType?: string;
}

@Injectable()
export class ActivityService {
  constructor(
    @Inject(getRepositoryToken(Activity))
    private readonly activityRepo: Repository<Activity>,
    @Inject(getRepositoryToken(SavedItem))
    private readonly savedItemRepo: Repository<SavedItem>
  ) {}

  async createActivity(data: CreateActivityData): Promise<Activity> {
    const activity = this.activityRepo.create(data);
    return await this.activityRepo.save(activity);
  }

  async findByProfile(
    profileId: string,
    options?: { type?: ActivityType; limit?: number; offset?: number }
  ): Promise<Activity[]> {
    const { type, limit = 50, offset = 0 } = options || {};
    const where: any = { profileId };
    if (type) {
      where.type = type;
    }
    return await this.activityRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findOne(id: string): Promise<Activity | null> {
    return await this.activityRepo.findOne({ where: { id } });
  }

  async deleteActivity(id: string): Promise<void> {
    await this.activityRepo.delete(id);
  }

  async saveItem(
    profileId: string,
    itemType: 'post' | 'comment',
    itemId: string,
    itemTitle?: string
  ): Promise<SavedItem> {
    const existing = await this.savedItemRepo.findOne({
      where: { profileId, itemType, itemId },
    });
    if (existing) {
      return existing;
    }
    const savedItem = this.savedItemRepo.create({
      profileId,
      itemType,
      itemId,
      itemTitle,
    });
    return await this.savedItemRepo.save(savedItem);
  }

  async unsaveItem(profileId: string, itemId: string): Promise<void> {
    await this.savedItemRepo.delete({ profileId, itemId });
  }

  async findSavedItems(profileId: string): Promise<SavedItem[]> {
    return await this.savedItemRepo.find({
      where: { profileId },
      order: { savedAt: 'DESC' },
    });
  }

  async isItemSaved(
    profileId: string,
    itemId: string
  ): Promise<{ saved: boolean }> {
    const item = await this.savedItemRepo.findOne({
      where: { profileId, itemId },
    });
    return { saved: !!item };
  }
}
