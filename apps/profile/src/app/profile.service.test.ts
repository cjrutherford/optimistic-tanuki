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
import { IsNull } from 'typeorm';

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
