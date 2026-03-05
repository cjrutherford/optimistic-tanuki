import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UserPresence,
  PresenceStatus,
} from '../../entities/user-presence.entity';

export interface UserPresenceData {
  userId: string;
  status: PresenceStatus;
  lastSeen?: Date;
}

@Injectable()
export class PresenceService {
  constructor(
    @Inject(getRepositoryToken(UserPresence))
    private readonly presenceRepo: Repository<UserPresence>
  ) {}

  async setPresence(
    userId: string,
    status: PresenceStatus,
    isExplicit: boolean = true
  ): Promise<UserPresence> {
    let presence = await this.presenceRepo.findOne({ where: { userId } });

    if (presence) {
      presence.status = status;
      presence.lastSeen = new Date();
      presence.isExplicit = isExplicit;
    } else {
      presence = this.presenceRepo.create({
        userId,
        status,
        lastSeen: new Date(),
        isExplicit,
      });
    }

    return await this.presenceRepo.save(presence);
  }

  async getPresence(userId: string): Promise<UserPresence | null> {
    return await this.presenceRepo.findOne({ where: { userId } });
  }

  async getPresenceBatch(userIds: string[]): Promise<UserPresence[]> {
    return await this.presenceRepo.findBy(
      userIds.map((id) => ({ userId: id }))
    );
  }

  async getOnlineUsers(): Promise<UserPresence[]> {
    return await this.presenceRepo.find({
      where: { status: PresenceStatus.ONLINE },
    });
  }

  async updateLastSeen(userId: string): Promise<void> {
    await this.presenceRepo.update(
      { userId },
      { lastSeen: new Date(), status: PresenceStatus.ONLINE, isExplicit: false }
    );
  }

  async setOffline(userId: string): Promise<void> {
    await this.presenceRepo.update(
      { userId },
      {
        status: PresenceStatus.OFFLINE,
        lastSeen: new Date(),
        isExplicit: false,
      }
    );
  }

  async deletePresence(userId: string): Promise<void> {
    await this.presenceRepo.delete({ userId });
  }
}
