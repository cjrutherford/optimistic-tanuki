import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrivacyService } from './privacy.service';
import { UserBlock } from '../../entities/user-block.entity';
import { UserMute } from '../../entities/user-mute.entity';
import { ContentReport, ReportReason } from '../../entities/content-report.entity';

describe('PrivacyService', () => {
  let service: PrivacyService;
  let userBlockRepo: Repository<UserBlock>;
  let userMuteRepo: Repository<UserMute>;
  let contentReportRepo: Repository<ContentReport>;

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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('blockUser', () => {
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
      jest.spyOn(userBlockRepo, 'delete').mockResolvedValue({ affected: 1 } as any);

      await service.unblockUser('user-1', 'user-2');

      expect(userBlockRepo.delete).toHaveBeenCalledWith({
        blockerId: 'user-1',
        blockedId: 'user-2',
      });
    });

    it('should not throw error if block does not exist', async () => {
      jest.spyOn(userBlockRepo, 'delete').mockResolvedValue({ affected: 0 } as any);

      await expect(service.unblockUser('user-1', 'user-2')).resolves.not.toThrow();
    });
  });

  describe('getBlockedUsers', () => {
    it('should return list of blocked users', async () => {
      const blockedUsers = [mockUserBlock, { ...mockUserBlock, id: 'block-456' }];
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

  describe('muteUser', () => {
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
      jest.spyOn(userMuteRepo, 'findOne').mockResolvedValue(mockUserMute);

      const result = await service.muteUser('user-1', 'user-3');

      expect(userMuteRepo.findOne).toHaveBeenCalled();
      expect(userMuteRepo.create).not.toHaveBeenCalled();
      expect(userMuteRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual(mockUserMute);
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
      jest.spyOn(userMuteRepo, 'delete').mockResolvedValue({ affected: 1 } as any);

      await service.unmuteUser('user-1', 'user-3');

      expect(userMuteRepo.delete).toHaveBeenCalledWith({
        muterId: 'user-1',
        mutedId: 'user-3',
      });
    });

    it('should not throw error if mute does not exist', async () => {
      jest.spyOn(userMuteRepo, 'delete').mockResolvedValue({ affected: 0 } as any);

      await expect(service.unmuteUser('user-1', 'user-3')).resolves.not.toThrow();
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

  describe('reportContent', () => {
    it('should create a content report', async () => {
      jest.spyOn(contentReportRepo, 'create').mockReturnValue(mockContentReport);
      jest.spyOn(contentReportRepo, 'save').mockResolvedValue(mockContentReport);

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
        status: 'pending',
      });
      expect(contentReportRepo.save).toHaveBeenCalledWith(mockContentReport);
      expect(result).toEqual(mockContentReport);
    });

    it('should create report without description', async () => {
      const reportWithoutDesc = { ...mockContentReport, description: undefined };
      jest.spyOn(contentReportRepo, 'create').mockReturnValue(reportWithoutDesc);
      jest.spyOn(contentReportRepo, 'save').mockResolvedValue(reportWithoutDesc);

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
        status: 'pending',
      });
      expect(result).toEqual(reportWithoutDesc);
    });

    it('should handle different content types', async () => {
      const contentTypes: Array<'post' | 'comment' | 'profile' | 'community' | 'message'> = [
        'post',
        'comment',
        'profile',
        'community',
        'message',
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

      const result = await service.getMyReports('user-1');

      expect(contentReportRepo.find).toHaveBeenCalledWith({
        where: { reporterId: 'user-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(reports);
    });

    it('should return empty array if no reports', async () => {
      jest.spyOn(contentReportRepo, 'find').mockResolvedValue([]);

      const result = await service.getMyReports('user-1');

      expect(result).toEqual([]);
    });
  });
});
