import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { UserBlock } from '../../entities/user-block.entity';
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
    private readonly presenceRepo: Repository<UserPresence>,
    @Inject(getRepositoryToken(UserBlock))
    private readonly userBlockRepo: Repository<UserBlock>
  ) {}

  private canonicalUuid(value: unknown): string {
    if (typeof value !== 'string' || !isUUID(value, 'all'))
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid presence identity',
      });
    return value.toLowerCase();
  }

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
    const id = this.canonicalUuid(userId);
    return await this.presenceRepo.findOne({ where: { userId: id } });
  }

  async getPresenceBatch(userIds: string[]): Promise<UserPresence[]> {
    if (!Array.isArray(userIds) || userIds.length > 100)
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid presence batch',
      });
    const ids = [...new Set(userIds.map((id) => this.canonicalUuid(id)))];
    if (!ids.length) return [];
    return await this.presenceRepo.findBy(ids.map((id) => ({ userId: id })));
  }

  async getOnlineUsers(userIds: string[] = []): Promise<UserPresence[]> {
    if (!Array.isArray(userIds) || userIds.length > 100)
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid online presence scope',
      });
    const ids = [...new Set(userIds.map((id) => this.canonicalUuid(id)))];
    if (!ids.length) return [];
    const rows = await this.presenceRepo.findBy(
      ids.map((userId) => ({ userId }))
    );
    return rows.filter((row) => row.status === PresenceStatus.ONLINE);
  }

  async getConversationPresence(request: {
    actorProfileId: string;
    bindings: Array<{ profileId: string; accountId: string }>;
  }): Promise<Array<{ profileId: string; status: PresenceStatus }>> {
    const actor = this.canonicalUuid(request?.actorProfileId);
    if (!Array.isArray(request?.bindings) || request.bindings.length > 100)
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid conversation presence request',
      });
    const parsed = request.bindings.map((binding) => ({
      profileId: this.canonicalUuid(binding?.profileId),
      accountId: this.canonicalUuid(binding?.accountId),
    }));
    const byProfile = new Map<string, string>();
    for (const binding of parsed) {
      const existing = byProfile.get(binding.profileId);
      if (existing && existing !== binding.accountId)
        throw new RpcException({
          statusCode: 503,
          message: 'Profile account binding is ambiguous',
        });
      byProfile.set(binding.profileId, binding.accountId);
    }
    const normalized = [...byProfile].map(([profileId, accountId]) => ({
      profileId,
      accountId,
    }));
    const profileIds = [...new Set(normalized.map((b) => b.profileId))];
    if (!normalized.length) return [];

    const blocks = await this.userBlockRepo
      .createQueryBuilder('block')
      .select('block.blockerId', 'blockerId')
      .addSelect('block.blockedId', 'blockedId')
      .where(
        '(LOWER(block.blockerId) = :actor AND LOWER(block.blockedId) IN (:...profileIds)) OR (LOWER(block.blockedId) = :actor AND LOWER(block.blockerId) IN (:...profileIds))',
        { actor, profileIds }
      )
      .limit(201)
      .getRawMany();
    if (blocks.length > 200)
      throw new RpcException({
        statusCode: 503,
        message: 'Block scope is ambiguous',
      });
    const blocked = new Set<string>();
    for (const block of blocks) {
      const left = block.blockerId?.toLowerCase();
      const right = block.blockedId?.toLowerCase();
      if (left === actor) blocked.add(right);
      if (right === actor) blocked.add(left);
    }
    const allowed = normalized.filter((b) => !blocked.has(b.profileId));
    if (!allowed.length) return [];
    const accountIds = [...new Set(allowed.map((b) => b.accountId))];
    const rows = await this.presenceRepo
      .createQueryBuilder('presence')
      .select('presence.userId', 'userId')
      .addSelect('presence.status', 'status')
      .where('LOWER(presence.userId) IN (:...accountIds)', { accountIds })
      .limit(101)
      .getRawMany();
    if (rows.length > 100)
      throw new RpcException({
        statusCode: 503,
        message: 'Presence rows are ambiguous',
      });
    const byAccount = new Map<string, UserPresence>();
    for (const row of rows) {
      const key = row.userId?.toLowerCase();
      if (!key || byAccount.has(key))
        throw new RpcException({
          statusCode: 503,
          message: 'Presence rows are ambiguous',
        });
      byAccount.set(key, row);
    }
    return allowed.flatMap(({ profileId, accountId }) => {
      const row = byAccount.get(accountId);
      return row && Object.values(PresenceStatus).includes(row.status)
        ? [{ profileId, status: row.status }]
        : [];
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
