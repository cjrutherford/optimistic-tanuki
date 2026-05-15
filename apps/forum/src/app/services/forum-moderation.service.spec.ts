import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForumModerationService } from './forum-moderation.service';
import { ForumReport } from '../../entities/forum-report.entity';
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
  };
  const threadService = {
    moderate: jest.fn(),
  };
  const forumPostService = {
    moderate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
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
      status: 'pending',
    };
    reportRepo.create.mockReturnValue(report);
    reportRepo.save.mockResolvedValue(report);

    const result = await service.reportContent({
      reporterId: 'profile-1',
      contentType: 'post',
      contentId: 'post-1',
      reason: 'spam',
    });

    expect(reportRepo.create).toHaveBeenCalledWith({
      reporterId: 'profile-1',
      contentType: 'post',
      contentId: 'post-1',
      reason: 'spam',
      status: 'pending',
    });
    expect(result).toEqual(report);
  });

  it('moderates a reported thread', async () => {
    threadService.moderate.mockResolvedValue({ id: 'thread-1' });

    await service.moderateThread(
      'thread-1',
      'hidden',
      'moderator-1',
      'Escalated harassment'
    );

    expect(threadService.moderate).toHaveBeenCalledWith(
      'thread-1',
      'hidden',
      'moderator-1',
      'Escalated harassment'
    );
  });

  it('moderates a reported forum post', async () => {
    forumPostService.moderate.mockResolvedValue({ id: 'post-1' });

    await service.moderatePost(
      'post-1',
      'visible',
      'moderator-2',
      'Restored after review'
    );

    expect(forumPostService.moderate).toHaveBeenCalledWith(
      'post-1',
      'visible',
      'moderator-2',
      'Restored after review'
    );
  });
});
