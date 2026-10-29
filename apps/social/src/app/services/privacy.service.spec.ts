import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrivacyService } from './privacy.service';
import { UserBlock } from '../../entities/user-block.entity';
import { UserMute } from '../../entities/user-mute.entity';
import {
  ContentReport,
  ReportReason,
} from '../../entities/content-report.entity';
import { Post } from '../../entities/post.entity';

describe('PrivacyService', () => {
  let service: PrivacyService;
  let userBlockRepo: Repository<UserBlock>;
  let userMuteRepo: Repository<UserMute>;
  let contentReportRepo: Repository<ContentReport>;
  const transactionManager = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    save: jest.fn((value) => Promise.resolve(value)),
    create: jest.fn((_entity, value) => value),
  };

  const mockUserBlock: UserBlock = {
    id: 'block-123',
    blockerId: 'user-1',
    blockedId: 'user-2',
    reason: 'Spam',
    createdAt: new Date('2024-01-01'),
  } as UserBlock;

  const mockUserMute: UserMute = {
    id: 'mute-123',
    muterId: 'user-1',
    mutedId: 'user-3',
    duration: 86400,
    createdAt: new Date('2024-01-01'),
  } as UserMute;

  const mockContentReport: ContentReport = {
    id: 'report-123',
    reporterId: 'user-1',
    contentType: 'post',
    contentId: 'post-123',
    reason: 'spam' as ReportReason,
    description: 'This is spam',
    status: 'pending',
    createdAt: new Date('2024-01-01'),
  } as ContentReport;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivacyService,
        {
          provide: getRepositoryToken(UserBlock),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserMute),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ContentReport),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            findOne: jest.fn(),
            manager: {
              transaction: jest.fn((callback) => callback(transactionManager)),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PrivacyService>(PrivacyService);
    userBlockRepo = module.get<Repository<UserBlock>>(
      getRepositoryToken(UserBlock)
    );
    userMuteRepo = module.get<Repository<UserMute>>(
      getRepositoryToken(UserMute)
    );
    contentReportRepo = module.get<Repository<ContentReport>>(
      getRepositoryToken(ContentReport)
    );
    transactionManager.findOne.mockReset();
    transactionManager.update.mockReset().mockResolvedValue({ affected: 1 });
    transactionManager.save
      .mockReset()
      .mockImplementation((value) => Promise.resolve(value));
    transactionManager.create
      .mockReset()
      .mockImplementation((_entity, value) => value);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('requires a report bound to the target app and workspace before moderator action', async () => {
    transactionManager.findOne.mockResolvedValue(mockContentReport);

    await (service.moderateContent as any)(
      'post',
      'post-123',
      'hidden',
      'moderator-1',
      'Reviewed',
      'report-123',
      'client-interface',
      'workspace-1'
    );

    expect(transactionManager.findOne).toHaveBeenCalledWith(ContentReport, {
      where: {
        id: 'report-123',
        appScope: 'client-interface',
        workspaceId: 'workspace-1',
        contentType: 'post',
        contentId: 'post-123',
      },
    });
  });

  describe('blockUser', () => {
    it('rejects malformed and self block targets before database access', async () => {
      await expect(service.blockUser('user-1', 'user-1')).rejects.toThrow(
        'different target profile'
      );
      expect(userBlockRepo.findOne).not.toHaveBeenCalled();
    });
    it('should create a new block when none exists', async () => {
      jest.spyOn(userBlockRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(userBlockRepo, 'create').mockReturnValue(mockUserBlock);
      jest.spyOn(userBlockRepo, 'save').mockResolvedValue(mockUserBlock);

      const result = await service.blockUser('user-1', 'user-2', 'Spam');

      expect(userBlockRepo.findOne).toHaveBeenCalledWith({
        where: { blockerId: 'user-1', blockedId: 'user-2' },
      });
      expect(userBlockRepo.create).toHaveBeenCalledWith({
        blockerId: 'user-1',
        blockedId: 'user-2',
        reason: 'Spam',
      });
      expect(userBlockRepo.save).toHaveBeenCalledWith(mockUserBlock);
      expect(result).toEqual(mockUserBlock);
    });

    it('should return existing block if already blocked', async () => {
      jest.spyOn(userBlockRepo, 'findOne').mockResolvedValue(mockUserBlock);

      const result = await service.blockUser('user-1', 'user-2');

      expect(userBlockRepo.findOne).toHaveBeenCalled();
      expect(userBlockRepo.create).not.toHaveBeenCalled();
      expect(userBlockRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual(mockUserBlock);
    });

    it('should create block without reason', async () => {
      const blockWithoutReason = { ...mockUserBlock, reason: undefined };
      jest.spyOn(userBlockRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(userBlockRepo, 'create').mockReturnValue(blockWithoutReason);
      jest.spyOn(userBlockRepo, 'save').mockResolvedValue(blockWithoutReason);

      const result = await service.blockUser('user-1', 'user-2');

      expect(userBlockRepo.create).toHaveBeenCalledWith({
        blockerId: 'user-1',
        blockedId: 'user-2',
        reason: undefined,
      });
      expect(result).toEqual(blockWithoutReason);
    });
  });

  describe('unblockUser', () => {
    it('should delete the block', async () => {
      jest
        .spyOn(userBlockRepo, 'delete')
        .mockResolvedValue({ affected: 1 } as any);

      await service.unblockUser('user-1', 'user-2');

      expect(userBlockRepo.delete).toHaveBeenCalledWith({
        blockerId: 'user-1',
        blockedId: 'user-2',
      });
    });

    it('should not throw error if block does not exist', async () => {
      jest
        .spyOn(userBlockRepo, 'delete')
        .mockResolvedValue({ affected: 0 } as any);

      await expect(
        service.unblockUser('user-1', 'user-2')
      ).resolves.not.toThrow();
    });
  });

  describe('getBlockedUsers', () => {
    it('should return list of blocked users', async () => {
      const blockedUsers = [
        mockUserBlock,
        { ...mockUserBlock, id: 'block-456' },
      ];
      jest.spyOn(userBlockRepo, 'find').mockResolvedValue(blockedUsers);

      const result = await service.getBlockedUsers('user-1');

      expect(userBlockRepo.find).toHaveBeenCalledWith({
        where: { blockerId: 'user-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(blockedUsers);
    });

    it('should return empty array if no blocked users', async () => {
      jest.spyOn(userBlockRepo, 'find').mockResolvedValue([]);

      const result = await service.getBlockedUsers('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('isUserBlocked', () => {
    it('should return true if user is blocked', async () => {
      jest.spyOn(userBlockRepo, 'findOne').mockResolvedValue(mockUserBlock);

      const result = await service.isUserBlocked('user-1', 'user-2');

      expect(userBlockRepo.findOne).toHaveBeenCalledWith({
        where: { blockerId: 'user-1', blockedId: 'user-2' },
      });
      expect(result).toBe(true);
    });

    it('should return false if user is not blocked', async () => {
      jest.spyOn(userBlockRepo, 'findOne').mockResolvedValue(null);

      const result = await service.isUserBlocked('user-1', 'user-2');

      expect(result).toBe(false);
    });
  });

  describe('moderateContent', () => {
    it('rejects unsupported moderation values before opening a transaction', async () => {
      await expect(
        service.moderateContent(
          'post' as any,
          'post-123',
          'suppressed' as any,
          'moderator-1',
          undefined,
          'report-123',
          'client-interface',
          'workspace-1'
        )
      ).rejects.toThrow('Unsupported moderation status.');
      expect(contentReportRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it('moderates a reported post and writes its audit in the same transaction', async () => {
      transactionManager.findOne.mockResolvedValue({
        id: 'report-123',
        appScope: 'client-interface',
        workspaceId: 'workspace-1',
        contentType: 'post',
        contentId: 'post-123',
      });

      const result = await service.moderateContent(
        'post',
        'post-123',
        'hidden',
        'moderator-1',
        'Spam cleanup',
        'report-123',
        'client-interface',
        'workspace-1'
      );

      expect(transactionManager.update).toHaveBeenCalledWith(
        Post,
        { id: 'post-123' },
        expect.objectContaining({
          moderatedBy: 'moderator-1',
          moderationStatus: 'hidden',
        })
      );
      expect(transactionManager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'content_moderation',
          appScope: 'client-interface',
          workspaceId: 'workspace-1',
          actorProfileId: 'moderator-1',
          reportId: 'report-123',
        })
      );
      expect(result).toEqual({ success: true });
    });

    it('rejects a report from another workspace before changing content', async () => {
      transactionManager.findOne.mockResolvedValue(null);

      await expect(
        service.moderateContent(
          'comment',
          'comment-123',
          'visible',
          'moderator-2',
          'Restored after appeal',
          'report-other-workspace',
          'client-interface',
          'workspace-1'
        )
      ).rejects.toThrow('Report was not found in this workspace.');

      expect(transactionManager.update).not.toHaveBeenCalled();
    });
  });

  describe('muteUser', () => {
    it('replaces an expired timed mute so a new mute takes effect', async () => {
      jest.spyOn(userMuteRepo, 'findOne').mockResolvedValue({
        ...mockUserMute,
        createdAt: new Date(Date.now() - 5000),
        duration: 1,
      });
      jest.spyOn(userMuteRepo, 'create').mockReturnValue(mockUserMute);
      jest.spyOn(userMuteRepo, 'save').mockResolvedValue(mockUserMute);

      await service.muteUser('user-1', 'user-3', 3600);

      expect(userMuteRepo.delete).toHaveBeenCalledWith({
        muterId: 'user-1',
        mutedId: 'user-3',
      });
      expect(userMuteRepo.save).toHaveBeenCalledWith(mockUserMute);
    });

    it('rejects invalid durations before database access', async () => {
      await expect(service.muteUser('user-1', 'user-3', -1)).rejects.toThrow(
        'Invalid mute target or duration'
      );
      expect(userMuteRepo.findOne).not.toHaveBeenCalled();
    });
    it('should create a new mute when none exists', async () => {
      jest.spyOn(userMuteRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(userMuteRepo, 'create').mockReturnValue(mockUserMute);
      jest.spyOn(userMuteRepo, 'save').mockResolvedValue(mockUserMute);

      const result = await service.muteUser('user-1', 'user-3', 86400);

      expect(userMuteRepo.findOne).toHaveBeenCalledWith({
        where: { muterId: 'user-1', mutedId: 'user-3' },
      });
      expect(userMuteRepo.create).toHaveBeenCalledWith({
        muterId: 'user-1',
        mutedId: 'user-3',
        duration: 86400,
      });
      expect(userMuteRepo.save).toHaveBeenCalledWith(mockUserMute);
      expect(result).toEqual(mockUserMute);
    });

    it('should return existing mute if already muted', async () => {
      const activeMute = {
        ...mockUserMute,
        createdAt: new Date(),
      };
      jest.spyOn(userMuteRepo, 'findOne').mockResolvedValue(activeMute);

      const result = await service.muteUser('user-1', 'user-3');

      expect(userMuteRepo.findOne).toHaveBeenCalled();
      expect(userMuteRepo.create).not.toHaveBeenCalled();
      expect(userMuteRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual(activeMute);
    });

    it('should create mute without duration (permanent)', async () => {
      const permanentMute = { ...mockUserMute, duration: undefined };
      jest.spyOn(userMuteRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(userMuteRepo, 'create').mockReturnValue(permanentMute);
      jest.spyOn(userMuteRepo, 'save').mockResolvedValue(permanentMute);

      const result = await service.muteUser('user-1', 'user-3');

      expect(userMuteRepo.create).toHaveBeenCalledWith({
        muterId: 'user-1',
        mutedId: 'user-3',
        duration: undefined,
      });
      expect(result).toEqual(permanentMute);
    });
  });

  describe('unmuteUser', () => {
    it('should delete the mute', async () => {
      jest
        .spyOn(userMuteRepo, 'delete')
        .mockResolvedValue({ affected: 1 } as any);

      await service.unmuteUser('user-1', 'user-3');

      expect(userMuteRepo.delete).toHaveBeenCalledWith({
        muterId: 'user-1',
        mutedId: 'user-3',
      });
    });

    it('should not throw error if mute does not exist', async () => {
      jest
        .spyOn(userMuteRepo, 'delete')
        .mockResolvedValue({ affected: 0 } as any);

      await expect(
        service.unmuteUser('user-1', 'user-3')
      ).resolves.not.toThrow();
    });
  });

  describe('getMutedUsers', () => {
    it('should return list of muted users', async () => {
      const mutedUsers = [mockUserMute, { ...mockUserMute, id: 'mute-456' }];
      jest.spyOn(userMuteRepo, 'find').mockResolvedValue(mutedUsers);

      const result = await service.getMutedUsers('user-1');

      expect(userMuteRepo.find).toHaveBeenCalledWith({
        where: { muterId: 'user-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mutedUsers);
    });

    it('should return empty array if no muted users', async () => {
      jest.spyOn(userMuteRepo, 'find').mockResolvedValue([]);

      const result = await service.getMutedUsers('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getActiveMutedUsers', () => {
    it('expires timed mutes from createdAt plus duration while retaining indefinite mutes', async () => {
      const now = new Date('2026-10-07T12:00:00.000Z');
      jest.spyOn(userMuteRepo, 'find').mockResolvedValue([
        {
          ...mockUserMute,
          mutedId: 'indefinite',
          duration: null,
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
        },
        {
          ...mockUserMute,
          mutedId: 'active',
          duration: 3600,
          createdAt: new Date('2026-10-07T11:30:00.000Z'),
        },
        {
          ...mockUserMute,
          mutedId: 'expired',
          duration: 60,
          createdAt: new Date('2026-10-07T11:00:00.000Z'),
        },
      ] as UserMute[]);

      const result = await service.getActiveMutedUsers('user-1', now);

      expect(result.map((mute) => mute.mutedId)).toEqual([
        'indefinite',
        'active',
      ]);
    });
  });

  describe('reportContent', () => {
    it('rejects unsupported report reason or malformed target before persistence', async () => {
      await expect(
        service.reportContent(
          'reporter-1',
          'post',
          'post-1',
          'invented-reason' as ReportReason
        )
      ).rejects.toThrow('Invalid content report target or reason.');
      await expect(
        service.reportContent('reporter-1', 'post', '   ', ReportReason.SPAM)
      ).rejects.toThrow('Invalid content report target or reason.');
      expect(contentReportRepo.create).not.toHaveBeenCalled();
    });
    it('should create a content report', async () => {
      jest
        .spyOn(contentReportRepo, 'create')
        .mockReturnValue(mockContentReport);
      jest
        .spyOn(contentReportRepo, 'save')
        .mockResolvedValue(mockContentReport);

      const result = await service.reportContent(
        'user-1',
        'post',
        'post-123',
        'spam' as ReportReason,
        'This is spam'
      );

      expect(contentReportRepo.create).toHaveBeenCalledWith({
        reporterId: 'user-1',
        contentType: 'post',
        contentId: 'post-123',
        reason: 'spam',
        description: 'This is spam',
        appScope: 'social',
        workspaceId: null,
        status: 'pending',
      });
      expect(contentReportRepo.save).toHaveBeenCalledWith(mockContentReport);
      expect(result).toEqual(mockContentReport);
    });

    it('should create report without description', async () => {
      const reportWithoutDesc = {
        ...mockContentReport,
        description: undefined,
      };
      jest
        .spyOn(contentReportRepo, 'create')
        .mockReturnValue(reportWithoutDesc);
      jest
        .spyOn(contentReportRepo, 'save')
        .mockResolvedValue(reportWithoutDesc);

      const result = await service.reportContent(
        'user-1',
        'comment',
        'comment-123',
        'harassment' as ReportReason
      );

      expect(contentReportRepo.create).toHaveBeenCalledWith({
        reporterId: 'user-1',
        contentType: 'comment',
        contentId: 'comment-123',
        reason: 'harassment',
        description: undefined,
        appScope: 'social',
        workspaceId: null,
        status: 'pending',
      });
      expect(result).toEqual(reportWithoutDesc);
    });

    it('should handle different content types', async () => {
      const contentTypes: Array<
        | 'post'
        | 'comment'
        | 'profile'
        | 'community'
        | 'message'
        | 'classified'
        | 'seller'
      > = [
        'post',
        'comment',
        'profile',
        'community',
        'message',
        'classified',
        'seller',
      ];

      for (const type of contentTypes) {
        const report = { ...mockContentReport, contentType: type };
        jest.spyOn(contentReportRepo, 'create').mockReturnValue(report);
        jest.spyOn(contentReportRepo, 'save').mockResolvedValue(report);

        const result = await service.reportContent(
          'user-1',
          type,
          'content-123',
          'spam' as ReportReason
        );

        expect(result.contentType).toBe(type);
      }
    });
  });

  describe('getMyReports', () => {
    it('should return list of user reports', async () => {
      const reports = [
        mockContentReport,
        { ...mockContentReport, id: 'report-456' },
      ];
      jest.spyOn(contentReportRepo, 'find').mockResolvedValue(reports);

      const result = await service.getMyReports('user-1', 'client-interface');

      expect(contentReportRepo.find).toHaveBeenCalledWith({
        where: { reporterId: 'user-1', appScope: 'client-interface' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(reports);
    });

    it('should return empty array if no reports', async () => {
      jest.spyOn(contentReportRepo, 'find').mockResolvedValue([]);

      const result = await service.getMyReports('user-1', 'client-interface');

      expect(result).toEqual([]);
    });
  });

  describe('moderator report scope', () => {
    it('lists and updates workspace-free reports by exact app scope', async () => {
      jest.spyOn(contentReportRepo, 'find').mockResolvedValue([]);
      await service.getAllReports(null, 'local-hub');
      expect(contentReportRepo.find).toHaveBeenCalledWith({
        where: { appScope: 'local-hub', workspaceId: expect.anything() },
        order: { createdAt: 'DESC' },
      });
    });

    it('lists only reports for the resolved workspace', async () => {
      jest
        .spyOn(contentReportRepo, 'find')
        .mockResolvedValue([
          { ...mockContentReport, workspaceId: 'workspace-1' },
        ]);

      await (service as any).getAllReports('workspace-1', 'client-interface');

      expect(contentReportRepo.find).toHaveBeenCalledWith({
        where: { appScope: 'client-interface', workspaceId: 'workspace-1' },
        order: { createdAt: 'DESC' },
      });
    });

    it('does not update a report outside the resolved workspace', async () => {
      transactionManager.findOne.mockResolvedValue(null);

      const result = await (service as any).updateReportStatus(
        'report-other-workspace',
        'reviewed',
        undefined,
        'workspace-1',
        'client-interface',
        'moderator-1'
      );

      expect(transactionManager.findOne).toHaveBeenCalledWith(ContentReport, {
        where: {
          id: 'report-other-workspace',
          appScope: 'client-interface',
          workspaceId: 'workspace-1',
        },
      });
      expect(transactionManager.update).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});
