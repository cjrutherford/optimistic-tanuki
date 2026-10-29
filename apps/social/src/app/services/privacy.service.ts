import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBlock } from '../../entities/user-block.entity';
import { UserMute } from '../../entities/user-mute.entity';
import {
  ContentReport,
  ReportReason,
} from '../../entities/content-report.entity';
import { ContentModerationAction } from '../../entities/content-moderation-action.entity';
import { Post } from '../../entities/post.entity';
import { Comment } from '../../entities/comment.entity';
import { IsNull } from 'typeorm';

const REPORT_STATUSES = new Set([
  'pending',
  'reviewed',
  'actioned',
  'dismissed',
]);
const MODERATION_STATUSES = new Set(['visible', 'hidden']);
const MODERATABLE_CONTENT_TYPES = new Set(['post', 'comment']);
const REPORT_CONTENT_TYPES = new Set([
  'post',
  'comment',
  'profile',
  'community',
  'message',
  'classified',
  'seller',
]);
const REPORT_REASONS = new Set(Object.values(ReportReason));

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
    if (!blockerId?.trim() || !blockedId?.trim() || blockerId === blockedId) {
      throw new BadRequestException('A different target profile is required.');
    }
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

  async getBlockersOf(blockedId: string): Promise<UserBlock[]> {
    return await this.userBlockRepo.find({
      where: { blockedId },
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
    if (
      !muterId?.trim() ||
      !mutedId?.trim() ||
      muterId === mutedId ||
      (duration !== undefined &&
        (!Number.isSafeInteger(duration) ||
          duration <= 0 ||
          duration > 31536000))
    ) {
      throw new BadRequestException('Invalid mute target or duration.');
    }
    // Check if already muted
    const existing = await this.userMuteRepo.findOne({
      where: { muterId, mutedId },
    });

    if (existing) {
      const expiresAt =
        existing.duration == null
          ? Number.POSITIVE_INFINITY
          : new Date(existing.createdAt).getTime() + existing.duration * 1000;
      if (expiresAt > Date.now()) return existing;
      await this.userMuteRepo.delete({ muterId, mutedId });
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

  async getActiveMutedUsers(
    muterId: string,
    now = new Date()
  ): Promise<UserMute[]> {
    const mutes = await this.getMutedUsers(muterId);
    return mutes.filter((mute) => {
      if (mute.duration == null) return true;
      const expiresAt =
        new Date(mute.createdAt).getTime() + mute.duration * 1000;
      return Number.isFinite(expiresAt) && expiresAt > now.getTime();
    });
  }

  // Report functionality
  async reportContent(
    reporterId: string,
    contentType:
      | 'post'
      | 'comment'
      | 'profile'
      | 'community'
      | 'message'
      | 'classified'
      | 'seller',
    contentId: string,
    reason: ReportReason,
    description?: string,
    appScope = 'social',
    workspaceId: string | null = null
  ): Promise<ContentReport> {
    if (
      !REPORT_CONTENT_TYPES.has(contentType) ||
      !contentId?.trim() ||
      !REPORT_REASONS.has(reason)
    ) {
      throw new BadRequestException('Invalid content report target or reason.');
    }
    const report = this.contentReportRepo.create({
      reporterId,
      contentType,
      contentId,
      reason,
      description,
      appScope,
      workspaceId,
      status: 'pending',
    });

    return await this.contentReportRepo.save(report);
  }

  async getMyReports(
    reporterId: string,
    appScope: string
  ): Promise<ContentReport[]> {
    return await this.contentReportRepo.find({
      where: { reporterId, appScope },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllReports(
    workspaceId: string | null | undefined,
    appScope: string
  ): Promise<ContentReport[]> {
    if (!appScope?.trim()) {
      return [];
    }
    return await this.contentReportRepo.find({
      where: {
        appScope,
        ...(workspaceId === undefined
          ? {}
          : { workspaceId: workspaceId === null ? IsNull() : workspaceId }),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async updateReportStatus(
    id: string,
    status: 'pending' | 'reviewed' | 'actioned' | 'dismissed',
    adminNotes: string | undefined,
    workspaceId: string | null | undefined,
    appScope: string,
    moderatedBy: string
  ): Promise<ContentReport | null> {
    if (!REPORT_STATUSES.has(status)) {
      throw new BadRequestException('Unsupported report status.');
    }
    const where = {
      id,
      appScope,
      ...(workspaceId === undefined
        ? {}
        : { workspaceId: workspaceId === null ? IsNull() : workspaceId }),
    };
    return this.contentReportRepo.manager.transaction(async (manager) => {
      const report = await manager.findOne(ContentReport, { where });
      if (!report) return null;
      report.status = status;
      report.adminNotes = adminNotes ?? null;
      await manager.save(report);
      await manager.save(
        manager.create(ContentModerationAction, {
          appScope,
          workspaceId: report.workspaceId,
          action: 'report_status',
          subjectType: report.contentType,
          subjectId: report.contentId,
          reportId: report.id,
          actorProfileId: moderatedBy,
          details: { status, adminNotes: adminNotes ?? null },
        })
      );
      return report;
    });
  }

  async moderateContent(
    contentType: 'post' | 'comment',
    contentId: string,
    moderationStatus: 'visible' | 'hidden',
    moderatedBy: string,
    adminNotes: string | undefined,
    reportId: string,
    appScope: string,
    workspaceId: string
  ): Promise<{ success: boolean }> {
    if (!MODERATION_STATUSES.has(moderationStatus)) {
      throw new BadRequestException('Unsupported moderation status.');
    }
    if (!MODERATABLE_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException('Unsupported content type.');
    }
    return this.contentReportRepo.manager.transaction(async (manager) => {
      const report = await manager.findOne(ContentReport, {
        where: {
          id: reportId,
          appScope,
          workspaceId,
          contentType,
          contentId,
        },
      });
      if (!report) {
        throw new NotFoundException('Report was not found in this workspace.');
      }

      const entity = contentType === 'post' ? Post : Comment;
      const update = await manager.update(
        entity,
        { id: contentId },
        {
          moderationStatus,
          moderationNotes: adminNotes ?? null,
          moderatedBy,
          moderatedAt: new Date(),
        }
      );
      if (!update.affected) {
        throw new NotFoundException('Reported content was not found.');
      }

      await manager.save(
        manager.create(ContentModerationAction, {
          appScope,
          workspaceId,
          action: 'content_moderation',
          subjectType: contentType,
          subjectId: contentId,
          reportId,
          actorProfileId: moderatedBy,
          details: { moderationStatus, adminNotes: adminNotes ?? null },
        })
      );
      return { success: true };
    });
  }
}
