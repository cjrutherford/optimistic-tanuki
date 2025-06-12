import { Test, TestingModule } from '@nestjs/testing';
import { ProfilesController } from './profiles.controller';
import { ProfileService } from '../app/profile.service';
import { CreateProfileDto } from '@optimistic-tanuki/models';

describe('ProfilesController', () => {
  let controller: ProfilesController;
  let mockProfileService: ProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfilesController],
      providers: [
        {
          provide: ProfileService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    mockProfileService = module.get<ProfileService>(ProfileService);
    controller = module.get<ProfilesController>(ProfilesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call createProfile', async () => {
    (mockProfileService.create as jest.Mock).mockResolvedValue({ id: '1', name: 'Test User', description: 'Test Description', userId: '12345' });
    const createProfileDto: CreateProfileDto = {
      name: 'Test User', description: 'Test Description', userId: '12345',
      profilePic: '',
      coverPic: '',
      bio: '',
      location: '',
      occupation: '',
      interests: '',
      skills: ''
    };
    const result = await controller.createProfile(createProfileDto);
    expect(result).toBeDefined();
    expect(mockProfileService.create).toHaveBeenCalledWith(createProfileDto);
  });

  it('should call getProfile', async () => {
    const profileId = '1';
    const mockProfile = { id: '1', name: 'Test User', description: 'Test Description', userId: '12345' };
    (mockProfileService.findOne as jest.Mock).mockResolvedValue(mockProfile);
    
    const result = await controller.getProfile({ id: profileId, query: {} });
    expect(result).toEqual(mockProfile);
    expect(mockProfileService.findOne).toHaveBeenCalledWith(profileId, {});
  });

  it('should call getAllProfiles', async () => {
    const mockProfiles = [
      { id: '1', name: 'Test User 1', description: 'Test Description 1', userId: '12345' },
      { id: '2', name: 'Test User 2', description: 'Test Description 2', userId: '67890' },
    ];
    (mockProfileService.findAll as jest.Mock).mockResolvedValue(mockProfiles);
    
    const result = await controller.getAllProfiles({});
    expect(result).toEqual(mockProfiles);
    expect(mockProfileService.findAll).toHaveBeenCalledWith({select: {
      id: true,
      profileName: true,
      bio: true,
      location: true,
      occupation: true,
      interests: true,
      skills: true,
      created_at: true,
      userId: true,
    }});
  });

  it('should call updateProfile', async () => {
    const updateProfileDto = { id: '1', name: 'Updated User', description: 'Updated Description', userId: '12345' };
    (mockProfileService.update as jest.Mock).mockResolvedValue({ id: '1', name: 'Updated User', description: 'Updated Description', userId: '12345' });
    
    const result = await controller.updateProfile(updateProfileDto);
    expect(result).toEqual({ id: '1', name: 'Updated User', description: 'Updated Description', userId: '12345' });
    expect(mockProfileService.update).toHaveBeenCalledWith(updateProfileDto.id, updateProfileDto);
  });
});
