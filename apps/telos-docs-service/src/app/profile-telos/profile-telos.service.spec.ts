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
    profileRepository = module.get<Repository<ProfileTelos>>(getRepositoryToken(ProfileTelos));

    // Mock repository methods
    jest.spyOn(profileRepository, 'create').mockImplementation((entity) => Object.assign(new ProfileTelos(), entity));
    jest.spyOn(profileRepository, 'save').mockImplementation(async (entity) => entity as ProfileTelos);
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
      const createDto = { name: 'Test Profile', description: 'Test Desc', goals: [], skills: [], interests: [], limitations: [], strengths: [], objectives: [], coreObjective: 'Test Obj', overallProfileSummary: 'Summary' };
      const expectedProfile = { id: '1', ...createDto };
      jest.spyOn(profileRepository, 'save').mockResolvedValue(expectedProfile as ProfileTelos);

      const result = await service.create(createDto);
      expect(profileRepository.create).toHaveBeenCalledWith(createDto);
      expect(profileRepository.save).toHaveBeenCalledWith(expect.any(ProfileTelos));
      expect(result).toEqual(expectedProfile);
    });
  });

  describe('findAll', () => {
    it('should return all profiles', async () => {
      const expectedProfiles = [{ id: '1', name: 'Test Profile' }] as ProfileTelos[];
      jest.spyOn(profileRepository, 'find').mockResolvedValue(expectedProfiles);

      const result = await service.findAll({});
      expect(profileRepository.find).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual(expectedProfiles);
    });

    it('should filter by name', async () => {
      const expectedProfiles = [{ id: '1', name: 'Test Profile' }] as ProfileTelos[];
      jest.spyOn(profileRepository, 'find').mockResolvedValue(expectedProfiles);

      const result = await service.findAll({ name: 'Test Profile' });
      expect(profileRepository.find).toHaveBeenCalledWith({ where: { name: 'Test Profile' } });
      expect(result).toEqual(expectedProfiles);
    });

    it('should filter by coreObjective using Like', async () => {
      const expectedProfiles = [{ id: '1', name: 'Test Profile' }] as ProfileTelos[];
      jest.spyOn(profileRepository, 'find').mockResolvedValue(expectedProfiles);

      const result = await service.findAll({ coreObjective: 'Test Obj' });
      expect(profileRepository.find).toHaveBeenCalledWith({ where: { coreObjective: expect.anything() } });
      expect(result).toEqual(expectedProfiles);
    });
  });

  describe('findOne', () => {
    it('should return a profile by id', async () => {
      const expectedProfile = { id: '1', name: 'Test Profile' } as ProfileTelos;
      jest.spyOn(profileRepository, 'findOne').mockResolvedValue(expectedProfile);

      const result = await service.findOne('1');
      expect(profileRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(expectedProfile);
    });
  });

  describe('update', () => {
    it('should update a profile and return it', async () => {
      const updateDto = { name: 'Updated Profile' };
      const existingProfile = { id: '1', name: 'Test Profile' } as ProfileTelos;
      const updatedProfile = { ...existingProfile, ...updateDto } as ProfileTelos;
      jest.spyOn(profileRepository, 'findOne').mockResolvedValue(updatedProfile);

      const result = await service.update('1', updateDto);
      expect(profileRepository.update).toHaveBeenCalledWith('1', updateDto);
      expect(profileRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(updatedProfile);
    });
  });

  describe('remove', () => {
    it('should delete a profile', async () => {
      await service.remove('1');
      expect(profileRepository.delete).toHaveBeenCalledWith('1');
    });
  });
});
