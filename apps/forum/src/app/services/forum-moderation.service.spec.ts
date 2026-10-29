import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForumModerationService } from './forum-moderation.service';
import { ForumReport } from '../../entities/forum-report.entity';
import { ForumModerationAction } from '../../entities/forum-moderation-action.entity';
import { Thread } from '../../entities/thread.entity';
import { ForumPost } from '../../entities/forum-post.entity';
import { ThreadService } from './thread.service';
import { ForumPostService } from './forum-post.service';

describe('ForumModerationService', () => {
  let service: ForumModerationService;
  const reportRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };
  const threadService = {
    findOne: jest.fn(),
    moderate: jest.fn(),
  };
  const forumPostService = {
    findOne: jest.fn(),
    moderate: jest.fn(),
  };
  const auditRepo = {
    create: jest.fn((action) => action),
  };
  const manager = {
    findOne: jest.fn(),
    save: jest.fn((action) => Promise.resolve(action)),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    reportRepo.manager.transaction.mockImplementation((callback) =>
      callback(manager)
    );
    threadService.findOne.mockResolvedValue({ id: 'thread-1' });
    forumPostService.findOne.mockResolvedValue({ id: 'post-1' });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumModerationService,
        {
          provide: getRepositoryToken(ForumReport),
          useValue: reportRepo,
        },
        {
          provide: ThreadService,
          useValue: threadService,
        },
        {
          provide: getRepositoryToken(ForumModerationAction),
          useValue: auditRepo,
        },
        {
          provide: ForumPostService,
          useValue: forumPostService,
        },
      ],
    }).compile();

    service = module.get(ForumModerationService);
  });

  it('creates a pending forum report', async () => {
    const report = {
      id: 'report-1',
      reporterId: 'profile-1',
      contentType: 'post',
      contentId: 'post-1',
      reason: 'spam',
      appScope: 'client-interface',
      status: 'pending',
    };
    reportRepo.create.mockReturnValue(report);
    reportRepo.save.mockResolvedValue(report);

    const result = await service.reportContent({
      reporterId: 'profile-1',
      contentType: 'post',
      contentId: 'post-1',
      reason: 'spam',
      appScope: 'client-interface',
    });

    expect(reportRepo.create).toHaveBeenCalledWith({
      reporterId: 'profile-1',
      contentType: 'post',
      contentId: 'post-1',
      reason: 'spam',
      appScope: 'client-interface',
      status: 'pending',
    });
    expect(result).toEqual(report);
  });

  it('rejects reports when the target is outside the caller app scope', async () => {
    threadService.findOne.mockResolvedValue(null);

    await expect(
      service.reportContent({
        reporterId: 'profile-1',
        contentType: 'thread',
        contentId: 'thread-in-other-app',
        reason: 'spam',
        appScope: 'client-interface',
      })
    ).rejects.toThrow('Reported forum content was not found.');
    expect(reportRepo.save).not.toHaveBeenCalled();
  });

  it('rejects unknown report types and reasons before resolving or saving a target', async () => {
    await expect(
      service.reportContent({
        reporterId: 'profile-1',
        contentType: 'community' as any,
        contentId: 'topic-1',
        reason: 'other',
        appScope: 'client-interface',
      })
    ).rejects.toThrow('Invalid forum report target or reason.');
    await expect(
      service.reportContent({
        reporterId: 'profile-1',
        contentType: 'thread',
        contentId: 'thread-1',
        reason: 'untrusted-reason',
        appScope: 'client-interface',
      })
    ).rejects.toThrow('Invalid forum report target or reason.');
    expect(threadService.findOne).not.toHaveBeenCalled();
    expect(reportRepo.save).not.toHaveBeenCalled();
  });

  it('filters reports to the requested app scope', async () => {
    reportRepo.find.mockResolvedValue([]);

    await service.getAllReports('client-interface');

    expect(reportRepo.find).toHaveBeenCalledWith({
      where: { appScope: 'client-interface' },
      order: { createdAt: 'DESC' },
    });
  });

  it('rejects unknown report status before opening an audit transaction', async () => {
    await expect(
      service.updateReportStatus(
        'report-1',
        'concealed' as any,
        undefined,
        'client-interface',
        'moderator-1'
      )
    ).rejects.toThrow('Unsupported report status.');
    expect(reportRepo.manager.transaction).not.toHaveBeenCalled();
  });

  it('rejects unknown moderation status before changing content or auditing', async () => {
    await expect(
      service.moderateThread(
        'thread-1',
        'concealed' as any,
        'moderator-1',
        undefined,
        'client-interface'
      )
    ).rejects.toThrow('Unsupported moderation status.');
    expect(reportRepo.manager.transaction).not.toHaveBeenCalled();
  });

  it('commits report status and append-only moderator audit in one transaction', async () => {
    const report = {
      id: 'report-1',
      appScope: 'client-interface',
      contentType: 'thread',
      contentId: 'thread-1',
      status: 'pending',
    };
    manager.findOne.mockResolvedValue(report);

    await service.updateReportStatus(
      'report-1',
      'reviewed',
      'Checked',
      'client-interface',
      'moderator-1'
    );

    expect(manager.save).toHaveBeenNthCalledWith(1, report);
    expect(manager.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: 'report_status',
        appScope: 'client-interface',
        actorProfileId: 'moderator-1',
        subjectType: 'thread',
        subjectId: 'thread-1',
        details: expect.objectContaining({
          reportId: 'report-1',
          status: 'reviewed',
        }),
      })
    );
  });

  it('moderates a reported thread', async () => {
    manager.update.mockResolvedValue({ affected: 1 });
    manager.findOne.mockResolvedValue({ id: 'thread-1' });

    await service.moderateThread(
      'thread-1',
      'hidden',
      'moderator-1',
      'Escalated harassment',
      'client-interface'
    );

    expect(manager.update).toHaveBeenCalledWith(
      Thread,
      { id: 'thread-1', appScope: 'client-interface' },
      expect.objectContaining({
        moderatedBy: 'moderator-1',
        moderationStatus: 'hidden',
      })
    );
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        appScope: 'client-interface',
        action: 'content_moderation',
        actorProfileId: 'moderator-1',
        subjectType: 'thread',
        subjectId: 'thread-1',
      })
    );
  });

  it('moderates a reported forum post', async () => {
    manager.update.mockResolvedValue({ affected: 1 });
    manager.findOne.mockResolvedValue({ id: 'post-1' });

    await service.moderatePost(
      'post-1',
      'visible',
      'moderator-2',
      'Restored after review',
      'client-interface'
    );

    expect(manager.update).toHaveBeenCalledWith(
      ForumPost,
      { id: 'post-1', appScope: 'client-interface' },
      expect.objectContaining({
        moderatedBy: 'moderator-2',
        moderationStatus: 'visible',
      })
    );
  });
});
