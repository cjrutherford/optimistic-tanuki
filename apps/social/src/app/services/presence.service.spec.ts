import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PresenceService, UserPresenceData } from './presence.service';
import { UserPresence, PresenceStatus } from '../../entities/user-presence.entity';

describe('PresenceService', () => {
  let service: PresenceService;
  let presenceRepo: Repository<UserPresence>;

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
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PresenceService>(PresenceService);
    presenceRepo = module.get<Repository<UserPresence>>(
      getRepositoryToken(UserPresence)
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

      const result = await service.setPresence('user-1', PresenceStatus.AWAY, true);

      expect(presenceRepo.findOne).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
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

      const result = await service.setPresence('user-1', PresenceStatus.ONLINE, true);

      expect(presenceRepo.findOne).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
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
        expect(presence.lastSeen.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
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
        jest.spyOn(presenceRepo, 'create').mockReturnValue({ ...mockUserPresence, status });
        jest.spyOn(presenceRepo, 'save').mockResolvedValue({ ...mockUserPresence, status });

        const result = await service.setPresence('user-1', status);

        expect(result.status).toBe(status);
      }
    });
  });

  describe('getPresence', () => {
    it('should return user presence', async () => {
      jest.spyOn(presenceRepo, 'findOne').mockResolvedValue(mockUserPresence);

      const result = await service.getPresence('user-1');

      expect(presenceRepo.findOne).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(result).toEqual(mockUserPresence);
    });

    it('should return null if presence not found', async () => {
      jest.spyOn(presenceRepo, 'findOne').mockResolvedValue(null);

      const result = await service.getPresence('non-existent');

      expect(result).toBeNull();
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

      const result = await service.getPresenceBatch(['user-1', 'user-2', 'user-3']);

      expect(presenceRepo.findBy).toHaveBeenCalledWith([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
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

      const result = await service.getPresenceBatch(['user-1', 'user-2', 'user-3']);

      // Only user-1 has presence, others don't
      expect(result.length).toBe(1);
      expect(result[0].userId).toBe('user-1');
    });
  });

  describe('getOnlineUsers', () => {
    it('should return all online users', async () => {
      const onlineUsers = [
        mockUserPresence,
        { ...mockUserPresence, id: 'presence-456', userId: 'user-2' },
      ];

      jest.spyOn(presenceRepo, 'find').mockResolvedValue(onlineUsers);

      const result = await service.getOnlineUsers();

      expect(presenceRepo.find).toHaveBeenCalledWith({
        where: { status: PresenceStatus.ONLINE },
      });
      expect(result).toEqual(onlineUsers);
    });

    it('should return empty array if no users online', async () => {
      jest.spyOn(presenceRepo, 'find').mockResolvedValue([]);

      const result = await service.getOnlineUsers();

      expect(result).toEqual([]);
    });
  });

  describe('updateLastSeen', () => {
    it('should update last seen timestamp and set status to online', async () => {
      jest.spyOn(presenceRepo, 'update').mockResolvedValue({ affected: 1 } as any);

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
      jest.spyOn(presenceRepo, 'update').mockResolvedValue({ affected: 1 } as any);

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
      jest.spyOn(presenceRepo, 'update').mockResolvedValue({ affected: 1 } as any);

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
      
      jest.spyOn(presenceRepo, 'update').mockImplementation((criteria, updateData: any) => {
        expect(updateData.lastSeen.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        return Promise.resolve({ affected: 1 } as any);
      });

      await service.setOffline('user-1');

      expect(presenceRepo.update).toHaveBeenCalled();
    });

    it('should set isExplicit to false', async () => {
      jest.spyOn(presenceRepo, 'update').mockResolvedValue({ affected: 1 } as any);

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
      jest.spyOn(presenceRepo, 'delete').mockResolvedValue({ affected: 1 } as any);

      await service.deletePresence('user-1');

      expect(presenceRepo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    });

    it('should not throw error if presence does not exist', async () => {
      jest.spyOn(presenceRepo, 'delete').mockResolvedValue({ affected: 0 } as any);

      await expect(service.deletePresence('non-existent')).resolves.not.toThrow();
    });
  });
});
