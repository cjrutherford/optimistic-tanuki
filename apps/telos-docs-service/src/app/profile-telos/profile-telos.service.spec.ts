import { Test, TestingModule } from '@nestjs/testing';
import { ProfileTelosService } from './profile-telos.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileTelos } from '../entities';

describe('ProfileTelosService', () => {
  let service: ProfileTelosService;
  let profileRepository: Repository<ProfileTelos>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileTelosService,
        {
          provide: getRepositoryToken(ProfileTelos),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<ProfileTelosService>(ProfileTelosService);
    profileRepository = module.get<Repository<ProfileTelos>>(
      getRepositoryToken(ProfileTelos)
    );

    // Mock repository methods
    jest
      .spyOn(profileRepository, 'create')
      .mockImplementation((entity) =>
        Object.assign(new ProfileTelos(), entity)
      );
    jest
      .spyOn(profileRepository, 'save')
      .mockImplementation(async (entity) => entity as ProfileTelos);
    jest.spyOn(profileRepository, 'find').mockResolvedValue([]);
    jest.spyOn(profileRepository, 'findOne').mockResolvedValue(null);
    jest.spyOn(profileRepository, 'update').mockResolvedValue(undefined);
    jest.spyOn(profileRepository, 'delete').mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a profile', async () => {
      const createDto = {
        profileId: 'profile-1',
        appScope: 'forgeofwill',
        name: 'Test Profile',
        description: 'Test Desc',
        goals: [],
        skills: [],
        interests: [],
        limitations: [],
        strengths: [],
        objectives: [],
        coreObjective: 'Test Obj',
        overallProfileSummary: 'Summary',
        generationStatus: 'ready' as const,
        sourceCount: 1,
        characterSheet: {
          classKey: 'scholar',
          classLabel: 'Scholar',
          archetypeSummary: 'Test summary',
          level: 1,
          stats: {
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 12,
            wisdom: 11,
            charisma: 10,
          },
          traits: [],
        },
      };
      const expectedProfile = { id: '1', ...createDto };
      jest
        .spyOn(profileRepository, 'save')
        .mockResolvedValue(expectedProfile as ProfileTelos);

      const result = await service.create(createDto);
      expect(profileRepository.create).toHaveBeenCalledWith({
        ...createDto,
        sourceFacts: [],
      });
      expect(profileRepository.save).toHaveBeenCalledWith(
        expect.any(ProfileTelos)
      );
      expect(result).toEqual(expectedProfile);
    });
  });

  describe('findAll', () => {
    it('should return all profiles', async () => {
      const expectedProfiles = [
        { id: '1', name: 'Test Profile' },
      ] as ProfileTelos[];
      jest.spyOn(profileRepository, 'find').mockResolvedValue(expectedProfiles);

      const result = await service.findAll({});
      expect(profileRepository.find).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual(expectedProfiles);
    });

    it('should filter by name', async () => {
      const expectedProfiles = [
        { id: '1', name: 'Test Profile' },
      ] as ProfileTelos[];
      jest.spyOn(profileRepository, 'find').mockResolvedValue(expectedProfiles);

      const result = await service.findAll({ name: 'Test Profile' });
      expect(profileRepository.find).toHaveBeenCalledWith({
        where: { name: 'Test Profile' },
      });
      expect(result).toEqual(expectedProfiles);
    });

    it('should filter by coreObjective using Like', async () => {
      const expectedProfiles = [
        { id: '1', name: 'Test Profile' },
      ] as ProfileTelos[];
      jest.spyOn(profileRepository, 'find').mockResolvedValue(expectedProfiles);

      const result = await service.findAll({ coreObjective: 'Test Obj' });
      expect(profileRepository.find).toHaveBeenCalledWith({
        where: { coreObjective: expect.anything() },
      });
      expect(result).toEqual(expectedProfiles);
    });
  });

  describe('findOne', () => {
    it('should return a profile by id', async () => {
      const expectedProfile = { id: '1', name: 'Test Profile' } as ProfileTelos;
      jest
        .spyOn(profileRepository, 'findOne')
        .mockResolvedValue(expectedProfile);

      const result = await service.findOne('1');
      expect(profileRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(result).toEqual(expectedProfile);
    });
  });

  describe('findByProfileId', () => {
    it('should return a profile by profileId', async () => {
      const expectedProfile = {
        id: '1',
        profileId: 'profile-1',
        name: 'Test Profile',
      } as unknown as ProfileTelos;
      jest
        .spyOn(profileRepository, 'findOne')
        .mockResolvedValue(expectedProfile);

      const result = await service.findByProfileId('profile-1');
      expect(profileRepository.findOne).toHaveBeenCalledWith({
        where: { profileId: 'profile-1' },
      });
      expect(result).toEqual(expectedProfile);
    });
  });

  describe('upsertSource', () => {
    it('should create a pending telos document when one does not exist', async () => {
      jest.spyOn(profileRepository, 'findOne').mockResolvedValue(null);

      const result = await service.upsertSource({
        profileId: 'profile-1',
        appScope: 'forgeofwill',
        profileName: 'Aela',
        bio: 'Ranger and scout',
        occupation: 'Adventurer',
        interests: ['mapping', 'tracking'],
        skills: ['bows', 'stealth'],
        facts: [
          {
            sourceType: 'profile',
            sourceId: 'profile-1',
            content: 'Aela is a patient scout who helps the party plan.',
          },
        ],
      });

      expect(profileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-1',
          appScope: 'forgeofwill',
          generationStatus: 'pending',
          sourceCount: 1,
        })
      );
      expect(result.profileId).toBe('profile-1');
      expect(result.generationStatus).toBe('pending');
    });

    it('should replace facts within the same namespace while preserving other namespaces', async () => {
      const existingProfile = {
        id: '1',
        profileId: 'profile-1',
        appScope: 'forgeofwill',
        name: 'Aela',
        description: '',
        goals: [],
        skills: [],
        interests: [],
        limitations: [],
        strengths: [],
        objectives: [],
        coreObjective: '',
        overallProfileSummary: '',
        generationStatus: 'ready',
        sourceFacts: [
          {
            sourceType: 'profile',
            sourceId: 'profile-1',
            content: 'Profile summary',
          },
          {
            sourceType: 'social:summary',
            sourceId: 'profile-1',
            content: 'Old social summary',
          },
          {
            sourceType: 'social:topic',
            sourceId: 'planning',
            content: 'Old planning topic',
          },
        ],
      } as unknown as ProfileTelos;

      jest
        .spyOn(profileRepository, 'findOne')
        .mockResolvedValue(existingProfile);

      const result = await service.upsertSource({
        profileId: 'profile-1',
        appScope: 'forgeofwill',
        profileName: 'Aela',
        bio: 'Ranger and scout',
        occupation: 'Adventurer',
        interests: ['mapping', 'tracking'],
        skills: ['bows', 'stealth'],
        facts: [
          {
            sourceType: 'social:summary',
            sourceId: 'profile-1',
            content: 'New social summary',
          },
          {
            sourceType: 'social:topic',
            sourceId: 'mapping',
            content: 'New mapping topic',
          },
        ],
      });

      expect((result as any).sourceFacts).toEqual([
        {
          sourceType: 'profile',
          sourceId: 'profile-1',
          content: 'Profile summary',
        },
        {
          sourceType: 'social:summary',
          sourceId: 'profile-1',
          content: 'New social summary',
        },
        {
          sourceType: 'social:topic',
          sourceId: 'mapping',
          content: 'New mapping topic',
        },
      ]);
      expect(result.sourceCount).toBe(3);
    });

    it('should schedule a follow-up regeneration when new source facts arrive during an in-flight run', async () => {
      jest.useFakeTimers();

      const existingProfile = {
        id: '1',
        profileId: 'profile-1',
        appScope: 'forgeofwill',
        name: 'Aela',
        description: '',
        goals: [],
        skills: [],
        interests: [],
        limitations: [],
        strengths: [],
        objectives: [],
        coreObjective: '',
        overallProfileSummary: '',
        generationStatus: 'ready',
        sourceFacts: [],
        characterSheet: {
          classKey: 'generalist',
          classLabel: 'Generalist',
          archetypeSummary: '',
          level: 1,
          stats: {
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10,
          },
          traits: [],
        },
      } as unknown as ProfileTelos;

      const findOneSpy = jest
        .spyOn(profileRepository, 'findOne')
        .mockResolvedValue(existingProfile);
      const regenerateSpy = jest
        .spyOn(service, 'regenerate')
        .mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve(existingProfile), 25);
            }) as Promise<ProfileTelos>
        );

      await service.upsertSource({
        profileId: 'profile-1',
        appScope: 'forgeofwill',
        profileName: 'Aela',
        bio: 'First update',
        interests: [],
        skills: [],
        facts: [
          {
            sourceType: 'social:summary',
            sourceId: 'profile-1',
            content: 'First social summary',
          },
        ],
      });

      jest.runOnlyPendingTimers();
      await Promise.resolve();

      await service.upsertSource({
        profileId: 'profile-1',
        appScope: 'forgeofwill',
        profileName: 'Aela',
        bio: 'Second update',
        interests: [],
        skills: [],
        facts: [
          {
            sourceType: 'social:summary',
            sourceId: 'profile-1',
            content: 'Second social summary',
          },
        ],
      });

      jest.advanceTimersByTime(25);
      await Promise.resolve();
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      jest.advanceTimersByTime(25);
      await Promise.resolve();

      expect(regenerateSpy).toHaveBeenCalledTimes(2);

      regenerateSpy.mockRestore();
      findOneSpy.mockRestore();
      jest.useRealTimers();
    });
  });

  describe('regenerate', () => {
    it('should derive a ready character sheet from stored source facts', async () => {
      const existingProfile = {
        id: '1',
        profileId: 'profile-1',
        appScope: 'forgeofwill',
        name: 'Aela',
        description: '',
        goals: [],
        skills: [],
        interests: [],
        limitations: [],
        strengths: [],
        objectives: [],
        coreObjective: '',
        overallProfileSummary: '',
        generationStatus: 'pending',
        sourceFacts: [
          {
            sourceType: 'profile',
            sourceId: 'profile-1',
            content:
              'Aela is a patient scout who loves mapping, stealth, and helping others prepare.',
          },
        ],
      } as unknown as ProfileTelos;

      jest
        .spyOn(profileRepository, 'findOne')
        .mockResolvedValue(existingProfile);
      jest
        .spyOn(profileRepository, 'save')
        .mockImplementation(async (entity) => entity as ProfileTelos);

      const result = await service.regenerate('profile-1');

      expect(result?.generationStatus).toBe('ready');
      expect(result?.characterSheet).toEqual(
        expect.objectContaining({
          classKey: expect.any(String),
          classLabel: expect.any(String),
          stats: expect.objectContaining({
            strength: expect.any(Number),
            dexterity: expect.any(Number),
            constitution: expect.any(Number),
            intelligence: expect.any(Number),
            wisdom: expect.any(Number),
            charisma: expect.any(Number),
          }),
        })
      );
      expect(result?.overallProfileSummary).toContain('Aela');
    });

    it('should use structured multi-slice metadata to resolve archetype quality', async () => {
      const existingProfile = {
        id: '1',
        profileId: 'profile-1',
        appScope: 'global',
        name: 'Avery',
        description: '',
        goals: [],
        skills: [],
        interests: [],
        limitations: [],
        strengths: [],
        objectives: [],
        coreObjective: '',
        overallProfileSummary: '',
        generationStatus: 'pending',
        sourceFacts: [
          {
            sourceType: 'social:summary',
            sourceId: 'profile-1',
            title: 'Social activity summary',
            content: 'Community activity is consistent.',
            metadata: {
              topics: ['leadership', 'planning'],
              communities: ['builders guild'],
            },
          },
          {
            sourceType: 'videos:topics',
            sourceId: 'profile-1',
            title: 'Recurring video topics',
            content: 'Video topics are recurring.',
            metadata: {
              topics: ['strategy', 'coordination'],
            },
          },
          {
            sourceType: 'blogging:publishing',
            sourceId: 'profile-1',
            title: 'Recent post titles',
            content: 'Recent titles are visible.',
            metadata: {
              recentTitles: ['Planning for resilient teams'],
            },
          },
        ],
      } as unknown as ProfileTelos;

      jest
        .spyOn(profileRepository, 'findOne')
        .mockResolvedValue(existingProfile);
      jest
        .spyOn(profileRepository, 'save')
        .mockImplementation(async (entity) => entity as ProfileTelos);

      const result = await service.regenerate('profile-1');

      expect(result?.generationStatus).toBe('ready');
      expect(result?.characterSheet.classKey).toBe('organizer');
      expect(result?.interests).toEqual(
        expect.arrayContaining(['leadership', 'planning', 'strategy'])
      );
      expect(result?.overallProfileSummary).toContain('organizer');
    });

    it('should raise character level from cross-slice activity breadth and counts', async () => {
      const existingProfile = {
        id: '1',
        profileId: 'profile-1',
        appScope: 'global',
        name: 'Morgan',
        description: '',
        goals: [],
        skills: [],
        interests: [],
        limitations: [],
        strengths: [],
        objectives: [],
        coreObjective: '',
        overallProfileSummary: '',
        generationStatus: 'pending',
        sourceFacts: [
          {
            sourceType: 'social:summary',
            sourceId: 'profile-1',
            title: 'Social activity summary',
            content: 'Social activity is visible.',
            metadata: {
              counts: {
                posts: 18,
                comments: 26,
                memberships: 5,
                followers: 14,
              },
            },
          },
          {
            sourceType: 'blogging:summary',
            sourceId: 'profile-1',
            title: 'Blogging activity summary',
            content: 'Blogging activity is visible.',
            metadata: {
              counts: {
                posts: 12,
                publishedPosts: 9,
                events: 3,
              },
            },
          },
          {
            sourceType: 'videos:summary',
            sourceId: 'profile-1',
            title: 'Video authorship summary',
            content: 'Video activity is visible.',
            metadata: {
              counts: {
                channels: 2,
                videos: 15,
                readyVideos: 12,
                subscribers: 44,
              },
            },
          },
          {
            sourceType: 'classifieds:summary',
            sourceId: 'profile-1',
            title: 'Classified listings summary',
            content: 'Marketplace activity is visible.',
            metadata: {
              counts: {
                listings: 8,
                soldListings: 5,
                featuredListings: 2,
              },
            },
          },
        ],
      } as unknown as ProfileTelos;

      jest
        .spyOn(profileRepository, 'findOne')
        .mockResolvedValue(existingProfile);
      jest
        .spyOn(profileRepository, 'save')
        .mockImplementation(async (entity) => entity as ProfileTelos);

      const result = await service.regenerate('profile-1');

      expect(result?.generationStatus).toBe('ready');
      expect(result?.characterSheet.level).toBeGreaterThan(4);
    });
  });

  describe('update', () => {
    it('should update a profile and return it', async () => {
      const updateDto = { id: '1', name: 'Updated Profile' };
      const existingProfile = { id: '1', name: 'Test Profile' } as ProfileTelos;
      const updatedProfile = {
        ...existingProfile,
        ...updateDto,
      } as ProfileTelos;
      jest
        .spyOn(profileRepository, 'findOne')
        .mockResolvedValue(updatedProfile);

      const result = await service.update('1', updateDto);
      expect(profileRepository.update).toHaveBeenCalledWith('1', updateDto);
      expect(profileRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(result).toEqual(updatedProfile);
    });
  });

  describe('remove', () => {
    it('should delete a profile', async () => {
      await service.remove('1');
      expect(profileRepository.delete).toHaveBeenCalledWith('1');
    });
  });

  describe('resetDerived', () => {
    it('should clear derived fields while preserving source facts for rebuilds', async () => {
      const existingProfile = {
        id: '1',
        profileId: 'profile-1',
        appScope: 'global',
        name: 'Avery',
        description: 'Previously derived description',
        goals: ['goal'],
        skills: ['skill'],
        interests: ['interest'],
        limitations: ['limitation'],
        strengths: ['strength'],
        objectives: ['objective'],
        coreObjective: 'core',
        overallProfileSummary: 'summary',
        generationStatus: 'ready',
        generatedAt: new Date('2026-06-01T00:00:00.000Z'),
        sourceUpdatedAt: new Date('2026-06-02T00:00:00.000Z'),
        sourceFacts: [
          {
            sourceType: 'social:summary',
            sourceId: 'profile-1',
            content: 'Recurring community leadership.',
          },
        ],
        characterSheet: {
          classKey: 'organizer',
          classLabel: 'Organizer',
          archetypeSummary: 'Coordinates people well.',
          level: 5,
          stats: {
            strength: 10,
            dexterity: 11,
            constitution: 12,
            intelligence: 13,
            wisdom: 14,
            charisma: 15,
          },
          traits: ['Steady'],
        },
      } as unknown as ProfileTelos;

      jest
        .spyOn(profileRepository, 'findOne')
        .mockResolvedValue(existingProfile);
      jest
        .spyOn(profileRepository, 'save')
        .mockImplementation(async (entity) => entity as ProfileTelos);

      const result = await service.resetDerived('profile-1');

      expect(result?.generationStatus).toBe('pending');
      expect(result?.overallProfileSummary).toBe('');
      expect(result?.goals).toEqual([]);
      expect(result?.characterSheet.level).toBe(1);
      expect(result?.sourceFacts).toEqual(existingProfile.sourceFacts);
      expect(result?.sourceCount).toBe(1);
    });
  });
});
