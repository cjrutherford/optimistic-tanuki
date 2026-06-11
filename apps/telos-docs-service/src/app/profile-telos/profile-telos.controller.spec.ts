import { Test, TestingModule } from '@nestjs/testing';
import { ProfileTelosController } from './profile-telos.controller';
import { ProfileTelosService } from './profile-telos.service';

describe('ProfileTelosController', () => {
  let controller: ProfileTelosController;
  let service: ProfileTelosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileTelosController],
      providers: [
        {
          provide: ProfileTelosService,
          useValue: {
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            findByProfileId: jest.fn(),
            upsertSource: jest.fn(),
            regenerate: jest.fn(),
            resetDerived: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProfileTelosController>(ProfileTelosController);
    service = module.get<ProfileTelosService>(ProfileTelosService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createProfile', () => {
    it('should call service.create with the provided data', async () => {
      const createDto = { name: 'Test Profile' } as any;
      await controller.createProfile(createDto);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('updateProfile', () => {
    it('should call service.update with the provided data', async () => {
      const updateDto = { id: '1', name: 'Updated Profile' } as any;
      await controller.updateProfile(updateDto);
      expect(service.update).toHaveBeenCalledWith(updateDto.id, updateDto);
    });
  });

  describe('deleteProfile', () => {
    it('should call service.remove with the provided id', async () => {
      const id = '1';
      await controller.deleteProfile(id);
      expect(service.remove).toHaveBeenCalledWith(id);
    });
  });

  describe('findProfile', () => {
    it('should call service.findOne with the provided id', async () => {
      const id = '1';
      await controller.findProfile(id);
      expect(service.findOne).toHaveBeenCalledWith(id);
    });
  });

  describe('findProfiles', () => {
    it('should call service.findAll with the provided query', async () => {
      const query = { name: 'Test' } as any;
      await controller.findProfiles(query);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findProfileByProfileId', () => {
    it('should call service.findByProfileId with the provided profileId', async () => {
      const profileId = 'profile-1';
      await controller.findProfileByProfileId({ profileId });
      expect(service.findByProfileId).toHaveBeenCalledWith(profileId);
    });
  });

  describe('upsertProfileSource', () => {
    it('should call service.upsertSource with the provided payload', async () => {
      const payload = { profileId: 'profile-1', facts: [] } as any;
      await controller.upsertProfileSource(payload);
      expect(service.upsertSource).toHaveBeenCalledWith(payload);
    });
  });

  describe('regenerateProfile', () => {
    it('should call service.regenerate with the provided profileId', async () => {
      const profileId = 'profile-1';
      await controller.regenerateProfile({ profileId });
      expect(service.regenerate).toHaveBeenCalledWith(profileId);
    });
  });

  describe('resetDerivedProfile', () => {
    it('should call service.resetDerived with the provided profileId', async () => {
      const profileId = 'profile-1';
      await controller.resetDerivedProfile({ profileId });
      expect(service.resetDerived).toHaveBeenCalledWith(profileId);
    });
  });
});
