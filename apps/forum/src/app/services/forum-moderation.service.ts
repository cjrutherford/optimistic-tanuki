import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForumReport } from '../../entities/forum-report.entity';
import { ThreadService } from './thread.service';
import { ForumPostService } from './forum-post.service';

@Injectable()
export class ForumModerationService {
  constructor(
    @Inject(getRepositoryToken(ForumReport))
    private readonly reportRepo: Repository<ForumReport>,
    private readonly threadService: ThreadService,
    private readonly forumPostService: ForumPostService
  ) {}

  async reportContent(data: {
    reporterId: string;
    contentType: 'thread' | 'post';
    contentId: string;
    reason: string;
    description?: string;
  }): Promise<ForumReport> {
    const report = this.reportRepo.create({
      ...data,
      status: 'pending',
    });
    return await this.reportRepo.save(report);
  }

  async getAllReports(): Promise<ForumReport[]> {
    return await this.reportRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async updateReportStatus(
    id: string,
    status: 'pending' | 'reviewed' | 'actioned' | 'dismissed',
    adminNotes?: string
  ): Promise<ForumReport | null> {
    await this.reportRepo.update(id, {
      status,
      adminNotes,
    });

    return await this.reportRepo.findOne({ where: { id } });
  }

  async moderateThread(
    id: string,
    moderationStatus: 'visible' | 'hidden',
    moderatedBy: string,
    adminNotes?: string
  ) {
    return await this.threadService.moderate(
      id,
      moderationStatus,
      moderatedBy,
      adminNotes
    );
  }

  async moderatePost(
    id: string,
    moderationStatus: 'visible' | 'hidden',
    moderatedBy: string,
    adminNotes?: string
  ) {
    return await this.forumPostService.moderate(
      id,
      moderationStatus,
      moderatedBy,
      adminNotes
    );
  }
}
