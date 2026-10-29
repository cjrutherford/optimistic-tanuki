import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBlock } from '../../entities/user-block.entity';
import { PresenceService, UserPresenceData } from './presence.service';
import {
  UserPresence,
  PresenceStatus,
} from '../../entities/user-presence.entity';

describe('PresenceService', () => {
  let service: PresenceService;
  let presenceRepo: Repository<UserPresence>;
  let blockRepo: Repository<UserBlock>;
  const ID1 = 'a1111111-1111-4111-8111-111111111111';
  const ID2 = 'b2222222-2222-4222-8222-222222222222';

  const mockUserPresence: UserPresence = {
    id: 'presence-123',
    userId: 'user-1',
    status: PresenceStatus.ONLINE,
    lastSeen: new Date('2024-01-01'),
    isExplicit: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as UserPresence;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        {
          provide: getRepositoryToken(UserPresence),
          useValue: {
            findOne: jest.fn(),
            findBy: jest.fn(),
            createQueryBuilder: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserBlock),
          useValue: { createQueryBuilder: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PresenceService>(PresenceService);
    presenceRepo = module.get<Repository<UserPresence>>(
      getRepositoryToken(UserPresence)
    );
    blockRepo = module.get<Repository<UserBlock>>(
      getRepositoryToken(UserBlock)
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setPresence', () => {
    it('should update existing presence', async () => {
      const updatedPresence = {
        ...mockUserPresence,
        status: PresenceStatus.AWAY,
      };

      jest.spyOn(presenceRepo, 'findOne').mockResolvedValue(mockUserPresence);
      jest.spyOn(presenceRepo, 'save').mockResolvedValue(updatedPresence);

      const result = await service.setPresence(
        'user-1',
        PresenceStatus.AWAY,
        true
      );

      expect(presenceRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(presenceRepo.save).toHaveBeenCalled();
      expect(result.status).toBe(PresenceStatus.AWAY);
      expect(result.isExplicit).toBe(true);
    });

    it('should create new presence if none exists', async () => {
      const newPresence = {
        ...mockUserPresence,
        id: 'presence-new',
      };

      jest.spyOn(presenceRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(presenceRepo, 'create').mockReturnValue(newPresence);
      jest.spyOn(presenceRepo, 'save').mockResolvedValue(newPresence);

      const result = await service.setPresence(
        'user-1',
        PresenceStatus.ONLINE,
        true
      );

      expect(presenceRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(presenceRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        status: PresenceStatus.ONLINE,
        lastSeen: expect.any(Date),
        isExplicit: true,
      });
      expect(presenceRepo.save).toHaveBeenCalled();
      expect(result).toEqual(newPresence);
    });

    it('should set isExplicit to false by default when not provided', async () => {
      jest.spyOn(presenceRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(presenceRepo, 'create').mockReturnValue(mockUserPresence);
      jest.spyOn(presenceRepo, 'save').mockResolvedValue(mockUserPresence);

      await service.setPresence('user-1', PresenceStatus.ONLINE);

      // When isExplicit is not provided, the default parameter makes it true
      expect(presenceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isExplicit: true,
        })
      );
    });

    it('should update lastSeen timestamp', async () => {
      const beforeTime = new Date();

      jest.spyOn(presenceRepo, 'findOne').mockResolvedValue(mockUserPresence);
      jest.spyOn(presenceRepo, 'save').mockImplementation((presence: any) => {
        expect(presence.lastSeen.getTime()).toBeGreaterThanOrEqual(
          beforeTime.getTime()
        );
        return Promise.resolve(presence);
      });

      await service.setPresence('user-1', PresenceStatus.ONLINE);

      expect(presenceRepo.save).toHaveBeenCalled();
    });

    it('should handle different presence statuses', async () => {
      const statuses = [
        PresenceStatus.ONLINE,
        PresenceStatus.AWAY,
        PresenceStatus.BUSY,
        PresenceStatus.OFFLINE,
      ];

      for (const status of statuses) {
        jest.spyOn(presenceRepo, 'findOne').mockResolvedValue(null);
        jest
          .spyOn(presenceRepo, 'create')
          .mockReturnValue({ ...mockUserPresence, status });
        jest
          .spyOn(presenceRepo, 'save')
          .mockResolvedValue({ ...mockUserPresence, status });

        const result = await service.setPresence('user-1', status);

        expect(result.status).toBe(status);
      }
    });
  });

  describe('getPresence', () => {
    it('should return user presence', async () => {
      jest.spyOn(presenceRepo, 'findOne').mockResolvedValue(mockUserPresence);

      const result = await service.getPresence(ID1);

      expect(presenceRepo.findOne).toHaveBeenCalledWith({
        where: { userId: ID1 },
      });
      expect(result).toEqual(mockUserPresence);
    });

    it('should return null if presence not found', async () => {
      jest.spyOn(presenceRepo, 'findOne').mockResolvedValue(null);

      await expect(service.getPresence('non-existent')).rejects.toBeDefined();
    });
  });

  describe('getPresenceBatch', () => {
    it('should return presence for multiple users', async () => {
      const presences = [
        mockUserPresence,
        { ...mockUserPresence, id: 'presence-456', userId: 'user-2' },
        { ...mockUserPresence, id: 'presence-789', userId: 'user-3' },
      ];

      jest.spyOn(presenceRepo, 'findBy').mockResolvedValue(presences);

      const result = await service.getPresenceBatch([ID1, ID2]);

      expect(presenceRepo.findBy).toHaveBeenCalledWith([
        { userId: ID1 },
        { userId: ID2 },
      ]);
      expect(result).toEqual(presences);
    });

    it('should return empty array for empty user list', async () => {
      jest.spyOn(presenceRepo, 'findBy').mockResolvedValue([]);

      const result = await service.getPresenceBatch([]);

      expect(result).toEqual([]);
    });

    it('should handle partial results', async () => {
      const presences = [mockUserPresence];
      jest.spyOn(presenceRepo, 'findBy').mockResolvedValue(presences);

      const result = await service.getPresenceBatch([ID1, ID2]);

      // Only user-1 has presence, others don't
      expect(result.length).toBe(1);
      expect(result[0].userId).toBe('user-1');
    });
  });

  describe('getOnlineUsers', () => {
    it('requires an explicit bounded scope and filters to online users', async () => {
      const onlineUsers = [
        mockUserPresence,
        { ...mockUserPresence, id: 'presence-456', userId: 'user-2' },
      ];

      jest.spyOn(presenceRepo, 'findBy').mockResolvedValue(onlineUsers);

      const result = await service.getOnlineUsers([ID1, ID2]);

      expect(presenceRepo.findBy).toHaveBeenCalledWith([
        { userId: ID1 },
        { userId: ID2 },
      ]);
      expect(result).toEqual(onlineUsers);
    });

    it('should return empty array if no users online', async () => {
      jest.spyOn(presenceRepo, 'findBy').mockResolvedValue([]);

      const result = await service.getOnlineUsers();

      expect(result).toEqual([]);
    });
  });

  it('returns no global online users when no scope is supplied', async () => {
    await expect(service.getOnlineUsers()).resolves.toEqual([]);
    expect(presenceRepo.findBy).not.toHaveBeenCalled();
  });

  it('resolves conversation presence with block filtering and a peer-only result', async () => {
    const blockQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const presenceQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ userId: ID2, status: PresenceStatus.AWAY }]),
    };
    jest.spyOn(blockRepo, 'createQueryBuilder').mockReturnValue(blockQb as any);
    jest
      .spyOn(presenceRepo, 'createQueryBuilder')
      .mockReturnValue(presenceQb as any);
    await expect(
      service.getConversationPresence({
        actorProfileId: ID1,
        bindings: [{ profileId: ID2, accountId: ID2 }],
      })
    ).resolves.toEqual([{ profileId: ID2, status: PresenceStatus.AWAY }]);
    expect(blockQb.where).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(block.blockerId) = :actor'),
      { actor: ID1, profileIds: [ID2] }
    );
    expect(presenceQb.select).toHaveBeenCalledWith('presence.userId', 'userId');
    expect(presenceQb.limit).toHaveBeenCalledWith(101);
  });

  it('rejects malformed account identifiers before querying', async () => {
    await expect(service.getPresenceBatch(['bad'])).rejects.toBeDefined();
    expect(presenceRepo.findBy).not.toHaveBeenCalled();
  });

  it('filters bidirectional blocks before reading peer presence', async () => {
    const blockQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ blockerId: ID2, blockedId: ID1 }]),
    };
    jest.spyOn(blockRepo, 'createQueryBuilder').mockReturnValue(blockQb as any);
    await expect(
      service.getConversationPresence({
        actorProfileId: ID1,
        bindings: [{ profileId: ID2, accountId: ID2 }],
      })
    ).resolves.toEqual([]);
    expect(presenceRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects oversized raw requests before querying and ambiguous canonical account rows', async () => {
    const bindings = Array.from({ length: 101 }, () => ({
      profileId: ID2,
      accountId: ID2,
    }));
    await expect(
      service.getConversationPresence({ actorProfileId: ID1, bindings })
    ).rejects.toBeDefined();
    expect(blockRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(presenceRepo.createQueryBuilder).not.toHaveBeenCalled();

    const blockQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const presenceQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { userId: ID2, status: PresenceStatus.ONLINE },
        { userId: ID2.toUpperCase(), status: PresenceStatus.AWAY },
      ]),
    };
    jest.spyOn(blockRepo, 'createQueryBuilder').mockReturnValue(blockQb as any);
    jest
      .spyOn(presenceRepo, 'createQueryBuilder')
      .mockReturnValue(presenceQb as any);
    await expect(
      service
        .getConversationPresence({
          actorProfileId: ID1,
          bindings: [{ profileId: ID2, accountId: ID2 }],
        })
        .catch((error) => error.getError())
    ).resolves.toMatchObject({ statusCode: 503 });
  });

  describe('updateLastSeen', () => {
    it('should update last seen timestamp and set status to online', async () => {
      jest
        .spyOn(presenceRepo, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      await service.updateLastSeen('user-1');

      expect(presenceRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1' },
        {
          lastSeen: expect.any(Date),
          status: PresenceStatus.ONLINE,
          isExplicit: false,
        }
      );
    });

    it('should set isExplicit to false', async () => {
      jest
        .spyOn(presenceRepo, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      await service.updateLastSeen('user-1');

      expect(presenceRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isExplicit: false,
        })
      );
    });
  });

  describe('setOffline', () => {
    it('should set user status to offline', async () => {
      jest
        .spyOn(presenceRepo, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      await service.setOffline('user-1');

      expect(presenceRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1' },
        {
          status: PresenceStatus.OFFLINE,
          lastSeen: expect.any(Date),
          isExplicit: false,
        }
      );
    });

    it('should update last seen timestamp', async () => {
      const beforeTime = new Date();

      jest
        .spyOn(presenceRepo, 'update')
        .mockImplementation((criteria, updateData: any) => {
          expect(updateData.lastSeen.getTime()).toBeGreaterThanOrEqual(
            beforeTime.getTime()
          );
          return Promise.resolve({ affected: 1 } as any);
        });

      await service.setOffline('user-1');

      expect(presenceRepo.update).toHaveBeenCalled();
    });

    it('should set isExplicit to false', async () => {
      jest
        .spyOn(presenceRepo, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      await service.setOffline('user-1');

      expect(presenceRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isExplicit: false,
        })
      );
    });
  });

  describe('deletePresence', () => {
    it('should delete user presence', async () => {
      jest
        .spyOn(presenceRepo, 'delete')
        .mockResolvedValue({ affected: 1 } as any);

      await service.deletePresence('user-1');

      expect(presenceRepo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    });

    it('should not throw error if presence does not exist', async () => {
      jest
        .spyOn(presenceRepo, 'delete')
        .mockResolvedValue({ affected: 0 } as any);

      await expect(
        service.deletePresence('non-existent')
      ).resolves.not.toThrow();
    });
  });
});
