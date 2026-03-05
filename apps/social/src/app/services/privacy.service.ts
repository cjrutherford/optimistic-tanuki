import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBlock } from '../../entities/user-block.entity';
import { UserMute } from '../../entities/user-mute.entity';
import {
  ContentReport,
  ReportReason,
} from '../../entities/content-report.entity';

export interface BlockedUserInfo {
  id: string;
  blockedId: string;
  blockedName: string;
  blockedAvatar?: string;
  createdAt: Date;
}

export interface MutedUserInfo {
  id: string;
  mutedId: string;
  mutedName: string;
  expiresAt?: Date;
  createdAt: Date;
}

@Injectable()
export class PrivacyService {
  constructor(
    @InjectRepository(UserBlock)
    private readonly userBlockRepo: Repository<UserBlock>,
    @InjectRepository(UserMute)
    private readonly userMuteRepo: Repository<UserMute>,
    @InjectRepository(ContentReport)
    private readonly contentReportRepo: Repository<ContentReport>
  ) {}

  // Block functionality
  async blockUser(
    blockerId: string,
    blockedId: string,
    reason?: string
  ): Promise<UserBlock> {
    // Check if already blocked
    const existing = await this.userBlockRepo.findOne({
      where: { blockerId, blockedId },
    });

    if (existing) {
      return existing;
    }

    const block = this.userBlockRepo.create({
      blockerId,
      blockedId,
      reason,
    });

    return await this.userBlockRepo.save(block);
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.userBlockRepo.delete({ blockerId, blockedId });
  }

  async getBlockedUsers(blockerId: string): Promise<UserBlock[]> {
    return await this.userBlockRepo.find({
      where: { blockerId },
      order: { createdAt: 'DESC' },
    });
  }

  async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const block = await this.userBlockRepo.findOne({
      where: { blockerId, blockedId },
    });
    return !!block;
  }

  // Mute functionality
  async muteUser(
    muterId: string,
    mutedId: string,
    duration?: number
  ): Promise<UserMute> {
    // Check if already muted
    const existing = await this.userMuteRepo.findOne({
      where: { muterId, mutedId },
    });

    if (existing) {
      return existing;
    }

    const mute = this.userMuteRepo.create({
      muterId,
      mutedId,
      duration,
    });

    return await this.userMuteRepo.save(mute);
  }

  async unmuteUser(muterId: string, mutedId: string): Promise<void> {
    await this.userMuteRepo.delete({ muterId, mutedId });
  }

  async getMutedUsers(muterId: string): Promise<UserMute[]> {
    return await this.userMuteRepo.find({
      where: { muterId },
      order: { createdAt: 'DESC' },
    });
  }

  // Report functionality
  async reportContent(
    reporterId: string,
    contentType: 'post' | 'comment' | 'profile' | 'community' | 'message',
    contentId: string,
    reason: ReportReason,
    description?: string
  ): Promise<ContentReport> {
    const report = this.contentReportRepo.create({
      reporterId,
      contentType,
      contentId,
      reason,
      description,
      status: 'pending',
    });

    return await this.contentReportRepo.save(report);
  }

  async getMyReports(reporterId: string): Promise<ContentReport[]> {
    return await this.contentReportRepo.find({
      where: { reporterId },
      order: { createdAt: 'DESC' },
    });
  }
}
