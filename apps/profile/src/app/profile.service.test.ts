import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { Profile } from '../profiles/entities/profile.entity';
import { CreateProfileDto } from '../profiles/dto/create-profile.dto';
import { UpdateProfileDto } from '../profiles/dto/update-profile.dto';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { of } from 'rxjs';
import { ILike, In, IsNull, Not } from 'typeorm';

describe('ProfileService', () => {
  let service: ProfileService;
  let repository: Repository<Profile>;

  const mockProfileRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockPermissionsClient = {
    send: jest.fn().mockReturnValue(of([])),
  };
  const mockAuthClient = {
    send: jest.fn().mockReturnValue(of({ allowed: true })),
  };

  beforeEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: getRepositoryToken(Profile),
          useValue: mockProfileRepository,
        },
        {
          provide: ServiceTokens.PERMISSIONS_SERVICE,
          useValue: mockPermissionsClient,
        },
        {
          provide: ServiceTokens.AUTHENTICATION_SERVICE,
          useValue: mockAuthClient,
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    repository = module.get<Repository<Profile>>(getRepositoryToken(Profile));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('guardian profile access', () => {
    const profile = {
      id: 'profile-1',
      userId: 'dependent-user',
      appScope: 'client-interface',
      profileName: 'Dependent',
      bio: 'private profile',
    } as Profile;
    const request = {
      profileId: 'profile-1',
      actorUserId: 'guardian-user',
      appId: 'client-interface',
      operation: 'profile.view' as const,
    };

    it('authorizes using the stored profile owner and audits a view before returning private fields', async () => {
      const auditRepository = { save: jest.fn().mockResolvedValue({}) };
      const manager = { getRepository: jest.fn().mockReturnValue(auditRepository) };
      (repository as any).manager = {
        transaction: jest.fn(async (work: any) => work(manager)),
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(profile);

      await expect(service.getGuardianProfile(request)).resolves.toBe(profile);
      expect(mockAuthClient.send).toHaveBeenCalledWith(
        expect.objectContaining({ cmd: expect.any(String) }),
        expect.objectContaining({
          actorUserId: 'guardian-user',
          dependentUserId: 'dependent-user',
          appId: 'client-interface',
          operation: 'profile.view',
        })
      );
      expect(auditRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'guardian-user',
          dependentUserId: 'dependent-user',
          operation: 'profile.view',
          changedFieldNames: [],
        })
      );
      const auditRow = auditRepository.save.mock.calls[0][0];
      expect(auditRow).not.toHaveProperty('dateOfBirth');
      expect(auditRow).not.toHaveProperty('token');
      expect(auditRow).not.toHaveProperty('profileValues');
    });

    it('rejects identity and scope fields in a guardian profile update before writing', async () => {
      await expect(
        service.updateGuardianProfile({
          ...request,
          operation: 'profile.manage',
          updates: { userId: 'other-user' } as any,
        })
      ).rejects.toThrow();
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('keeps the dependent update and audit write inside one transaction and rejects audit failure', async () => {
      const profileRepository = {
        findOne: jest.fn().mockResolvedValue(profile),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const auditRepository = { save: jest.fn().mockRejectedValue(new Error('audit unavailable')) };
      const manager = {
        getRepository: jest.fn((entity: unknown) => entity === Profile ? profileRepository : auditRepository),
      };
      const transaction = jest.fn((work: (manager: any) => unknown) => work(manager));
      (repository as any).manager = { transaction };
      mockAuthClient.send.mockReturnValue(of({ allowed: true }));

      await expect(service.updateGuardianProfile({
        ...request,
        operation: 'profile.manage',
        updates: { bio: 'changed' },
      })).rejects.toThrow('audit unavailable');
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(profileRepository.update).toHaveBeenCalled();
      expect(auditRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        actorUserId: 'guardian-user',
        dependentUserId: 'dependent-user',
        changedFieldNames: ['bio'],
      }));
    });

    it('purges guardian activity at the inclusive 90-day retention boundary', async () => {
      const deleteActivity = jest.fn().mockResolvedValue({ affected: 1 });
      (repository as any).manager = { delete: deleteActivity };
      const now = new Date('2026-10-14T12:00:00.000Z');

      await service.purgeGuardianActivity(now);

      expect(deleteActivity).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ createdAt: expect.objectContaining({ type: 'lessThanOrEqual', value: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) }) })
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of profiles', async () => {
      const result = [new Profile()];
      jest.spyOn(repository, 'find').mockResolvedValue(result);

      expect(await service.findAll()).toBe(result);
    });
  });

  describe('findOne', () => {
    it('should return a single profile', async () => {
      const id = '1';
      const result = new Profile();
      jest.spyOn(repository, 'findOne').mockResolvedValue(result);

      expect(await service.findOne(id)).toBe(result);
    });
  });

  it('never persists a caller supplied owner through the generic profile update RPC', async () => {
    const id = 'profile-owned';
    mockProfileRepository.update.mockResolvedValue({ affected: 1 });
    mockProfileRepository.findOne.mockResolvedValue({ id, userId: 'owner' } as Profile);

    await service.update(id, { id, userId: 'forged-owner' } as UpdateProfileDto);

    expect(mockProfileRepository.update).toHaveBeenCalledWith(
      id,
      expect.not.objectContaining({ userId: 'forged-owner' })
    );
  });

  describe('create', () => {
    it('should create and return a profile', async () => {
      const createProfileDto: CreateProfileDto = {
        name: 'Test',
        description: '',
        userId: '',
        profilePic: '',
        coverPic: '',
        bio: '',
        location: '',
        occupation: '',
        interests: '',
        skills: '',
      };
      const result = new Profile();
      // Mock findOne to return null (no existing profile) so create proceeds
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      jest.spyOn(repository, 'save').mockResolvedValue(result);

      expect(await service.create(createProfileDto)).toBe(result);
    });

    it('should return existing profile if one already exists for user+appScope', async () => {
      const createProfileDto: CreateProfileDto & { appScope?: string } = {
        name: 'Test',
        description: '',
        userId: 'user-123',
        profilePic: '',
        coverPic: '',
        bio: '',
        location: '',
        occupation: '',
        interests: '',
        skills: '',
        appScope: 'client-interface',
      };
      const existingProfile = new Profile();
      existingProfile.id = 'existing-id';
      // Mock findOne to return an existing profile
      jest.spyOn(repository, 'findOne').mockResolvedValue(existingProfile);

      expect(await service.create(createProfileDto)).toBe(existingProfile);
    });

    it('should not copy permissions when copyPermissionsFromGlobalProfile is false', async () => {
      const createProfileDto: CreateProfileDto & {
        appScope?: string;
        copyPermissionsFromGlobalProfile?: boolean;
      } = {
        name: 'Test',
        description: '',
        userId: 'user-123',
        profilePic: '',
        coverPic: '',
        bio: '',
        location: '',
        occupation: '',
        interests: '',
        skills: '',
        appScope: 'forgeofwill',
        copyPermissionsFromGlobalProfile: false,
      };

      const savedProfile = {
        id: 'new-profile-id',
        userId: 'user-123',
      } as Profile;

      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(null);
      jest.spyOn(repository, 'save').mockResolvedValue(savedProfile);

      await service.create(createProfileDto);

      expect(mockPermissionsClient.send).not.toHaveBeenCalled();
    });

    it('should reuse a legacy null-scoped global profile', async () => {
      const legacyGlobalProfile = {
        id: 'legacy-global-id',
        userId: 'user-123',
        appScope: null,
      } as Profile;

      jest
        .spyOn(repository, 'findOne')
        .mockResolvedValueOnce(legacyGlobalProfile);

      await expect(
        service.create({
          name: 'Owner',
          description: '',
          userId: 'user-123',
          profilePic: '',
          coverPic: '',
          bio: '',
          location: '',
          occupation: '',
          interests: '',
          skills: '',
          appScope: 'global',
        })
      ).resolves.toBe(legacyGlobalProfile);
    });

    it('should return the existing profile after a duplicate-key race on save', async () => {
      const existingProfile = {
        id: 'existing-id',
        userId: 'user-123',
        appScope: 'client-interface',
      } as Profile;

      jest
        .spyOn(repository, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingProfile);
      jest.spyOn(repository, 'save').mockRejectedValueOnce({
        code: '23505',
        detail: 'duplicate key value violates unique constraint',
      });

      await expect(
        service.create({
          name: 'Test',
          description: '',
          userId: 'user-123',
          profilePic: '',
          coverPic: '',
          bio: '',
          location: '',
          occupation: '',
          interests: '',
          skills: '',
          appScope: 'client-interface',
        })
      ).resolves.toBe(existingProfile);
    });
  });

  describe('findByUserIdAndAppScope', () => {
    it('should treat global scope as global-or-null', async () => {
      const result = {
        id: 'global-profile-id',
        userId: 'user-123',
        appScope: null,
      } as Profile;
      jest.spyOn(repository, 'findOne').mockResolvedValue(result);

      await expect(
        service.findByUserIdAndAppScope('user-123', 'global')
      ).resolves.toBe(result);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: [
          { userId: 'user-123', appScope: 'global' },
          { userId: 'user-123', appScope: IsNull() },
        ],
      });
    });
  });

  describe('searchProfiles', () => {
    it('builds an ILike where on profileName OR bio for a text query', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([]);

      await service.searchProfiles({ query: 'chris' });

      expect(repository.find).toHaveBeenCalledWith({
        where: [{ profileName: ILike('%chris%') }, { bio: ILike('%chris%') }],
        order: { profileName: 'ASC' },
        take: 20,
        skip: 0,
      });
    });

    it('applies excludeIds only when non-empty', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([]);

      await service.searchProfiles({ query: 'chris', excludeIds: ['a', 'b'] });

      expect(repository.find).toHaveBeenCalledWith({
        where: [
          { id: Not(In(['a', 'b'])), profileName: ILike('%chris%') },
          { id: Not(In(['a', 'b'])), bio: ILike('%chris%') },
        ],
        order: { profileName: 'ASC' },
        take: 20,
        skip: 0,
      });
    });

    it('ignores an empty excludeIds array', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([]);

      await service.searchProfiles({ query: 'chris', excludeIds: [] });

      expect(repository.find).toHaveBeenCalledWith({
        where: [{ profileName: ILike('%chris%') }, { bio: ILike('%chris%') }],
        order: { profileName: 'ASC' },
        take: 20,
        skip: 0,
      });
    });

    it('caps the limit at the hard maximum', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([]);

      await service.searchProfiles({ limit: 5000 });

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });

    it('returns paged results without a text predicate when query is empty', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([]);

      await service.searchProfiles({
        excludeIds: ['a'],
        limit: 10,
        offset: 20,
      });

      expect(repository.find).toHaveBeenCalledWith({
        where: { id: Not(In(['a'])) },
        order: { profileName: 'ASC' },
        take: 10,
        skip: 20,
      });
    });
  });

  describe('update', () => {
    it('should update and return a profile', async () => {
      const id = '1';
      const updateProfileDto: UpdateProfileDto = {
        name: 'Updated Test',
        id: '1',
      };
      const result = new Profile();
      jest.spyOn(repository, 'update').mockResolvedValue(undefined);
      jest.spyOn(repository, 'findOne').mockResolvedValue(result);

      expect(await service.update(id, updateProfileDto)).toBe(result);
    });
  });
});
