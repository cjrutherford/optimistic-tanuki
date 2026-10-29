import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForumReport } from '../../entities/forum-report.entity';
import { ForumModerationAction } from '../../entities/forum-moderation-action.entity';
import { Thread } from '../../entities/thread.entity';
import { ForumPost } from '../../entities/forum-post.entity';
import { ThreadService } from './thread.service';
import { ForumPostService } from './forum-post.service';

const REPORT_STATUSES = new Set([
  'pending',
  'reviewed',
  'actioned',
  'dismissed',
]);
const MODERATION_STATUSES = new Set(['visible', 'hidden']);
const REPORT_CONTENT_TYPES = new Set(['thread', 'post']);
const REPORT_REASONS = new Set([
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'misinformation',
  'inappropriate',
  'other',
]);

@Injectable()
export class ForumModerationService {
  constructor(
    @Inject(getRepositoryToken(ForumReport))
    private readonly reportRepo: Repository<ForumReport>,
    private readonly threadService: ThreadService,
    private readonly forumPostService: ForumPostService,
    @Inject(getRepositoryToken(ForumModerationAction))
    private readonly actionRepo: Repository<ForumModerationAction>
  ) {}

  async reportContent(data: {
    reporterId: string;
    contentType: 'thread' | 'post';
    contentId: string;
    reason: string;
    description?: string;
    appScope: string;
  }): Promise<ForumReport> {
    if (!data.appScope?.trim()) {
      throw new BadRequestException('Application scope is required.');
    }
    if (
      !REPORT_CONTENT_TYPES.has(data.contentType) ||
      !data.contentId?.trim() ||
      !REPORT_REASONS.has(data.reason) ||
      (data.description !== undefined && data.description.length > 2000)
    ) {
      throw new BadRequestException('Invalid forum report target or reason.');
    }
    const target =
      data.contentType === 'thread'
        ? await this.threadService.findOne(data.contentId, {
            where: { id: data.contentId, appScope: data.appScope },
          })
        : await this.forumPostService.findOne(data.contentId, {
            where: { id: data.contentId, appScope: data.appScope },
          });
    if (!target) {
      throw new BadRequestException('Reported forum content was not found.');
    }
    const report = this.reportRepo.create({
      ...data,
      status: 'pending',
    });
    return await this.reportRepo.save(report);
  }

  async getAllReports(appScope: string): Promise<ForumReport[]> {
    if (!appScope?.trim()) {
      throw new BadRequestException('Application scope is required.');
    }
    return await this.reportRepo.find({
      where: { appScope },
      order: { createdAt: 'DESC' },
    });
  }

  async updateReportStatus(
    id: string,
    status: 'pending' | 'reviewed' | 'actioned' | 'dismissed',
    adminNotes: string | undefined,
    appScope: string,
    moderatedBy: string
  ): Promise<ForumReport | null> {
    if (!REPORT_STATUSES.has(status)) {
      throw new BadRequestException('Unsupported report status.');
    }
    return this.reportRepo.manager.transaction(async (manager) => {
      const report = await manager.findOne(ForumReport, {
        where: { id, appScope },
      });
      if (!report) return null;
      report.status = status;
      report.adminNotes = adminNotes ?? null;
      await manager.save(report);
      await manager.save(
        this.actionRepo.create({
          appScope,
          action: 'report_status',
          subjectType: report.contentType,
          subjectId: report.contentId,
          actorProfileId: moderatedBy,
          details: {
            reportId: report.id,
            status,
            adminNotes: adminNotes ?? null,
          },
        })
      );
      return report;
    });
  }

  async moderateThread(
    id: string,
    moderationStatus: 'visible' | 'hidden',
    moderatedBy: string,
    adminNotes: string | undefined,
    appScope: string
  ) {
    if (!MODERATION_STATUSES.has(moderationStatus)) {
      throw new BadRequestException('Unsupported moderation status.');
    }
    return this.reportRepo.manager.transaction(async (manager) => {
      const result = await manager.update(
        Thread,
        { id, appScope },
        {
          moderationStatus,
          moderationNotes: adminNotes ?? null,
          moderatedBy,
          moderatedAt: new Date(),
        }
      );
      if (!result.affected) return null;
      await manager.save(
        this.actionRepo.create({
          appScope,
          action: 'content_moderation',
          subjectType: 'thread',
          subjectId: id,
          actorProfileId: moderatedBy,
          details: { moderationStatus, adminNotes: adminNotes ?? null },
        })
      );
      return manager.findOne(Thread, { where: { id, appScope } });
    });
  }

  async moderatePost(
    id: string,
    moderationStatus: 'visible' | 'hidden',
    moderatedBy: string,
    adminNotes: string | undefined,
    appScope: string
  ) {
    if (!MODERATION_STATUSES.has(moderationStatus)) {
      throw new BadRequestException('Unsupported moderation status.');
    }
    return this.reportRepo.manager.transaction(async (manager) => {
      const result = await manager.update(
        ForumPost,
        { id, appScope },
        {
          moderationStatus,
          moderationNotes: adminNotes ?? null,
          moderatedBy,
          moderatedAt: new Date(),
        }
      );
      if (!result.affected) return null;
      await manager.save(
        this.actionRepo.create({
          appScope,
          action: 'content_moderation',
          subjectType: 'post',
          subjectId: id,
          actorProfileId: moderatedBy,
          details: { moderationStatus, adminNotes: adminNotes ?? null },
        })
      );
      return manager.findOne(ForumPost, { where: { id, appScope } });
    });
  }
}
