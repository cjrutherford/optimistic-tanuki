import { CreateProfileDto, UpdateProfileDto } from '@optimistic-tanuki/models';
import { Test, TestingModule } from '@nestjs/testing';

import { ProfileService } from '../app/profile.service';
import { ProfilesController } from './profiles.controller';

describe('ProfilesController', () => {
  let controller: ProfilesController;
  let service: jest.Mocked<ProfileService>;

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

    controller = module.get<ProfilesController>(ProfilesController);
    service = module.get(ProfileService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a profile', async () => {
    const dto: CreateProfileDto = {
      name: 'Test',
      description: 'desc',
      userId: 'user1',
      profilePic: 'pic.jpg',
      coverPic: 'cover.jpg',
      bio: 'bio',
      location: 'Earth',
      occupation: 'Dev',
      interests: 'coding',
      skills: 'TypeScript'
    };
    (service.create as jest.Mock).mockResolvedValue('created');
    const result = await controller.createProfile(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toBe('created');
  });

  it('should get a profile', async () => {
    const data = { id: '1', query: {} };
    (service.findOne as jest.Mock).mockResolvedValue('profile');
    const result = await controller.getProfile(data);
    expect(service.findOne).toHaveBeenCalledWith('1', {});
    expect(result).toBe('profile');
  });

  it('should get all profiles', async () => {
    const query = { where: { userId: '1' } };
    (service.findAll as jest.Mock).mockResolvedValue(['profile']);
    const result = await controller.getAllProfiles(query);
    expect(service.findAll).toHaveBeenCalledWith(expect.objectContaining(query));
    expect(result).toEqual(['profile']);
  });

  it('should update a profile', async () => {
    const dto: UpdateProfileDto = {
      id: '1',
      name: 'Updated',
      description: 'desc',
      userId: 'user1',
      profilePic: 'pic.jpg',
      coverPic: 'cover.jpg',
      bio: 'bio',
      location: 'Earth',
      occupation: 'Dev',
      interests: 'coding',
      skills: 'TypeScript'
    };
    (service.update as jest.Mock).mockResolvedValue('updated');
    const result = await controller.updateProfile(dto);
    expect(service.update).toHaveBeenCalledWith('1', dto);
    expect(result).toBe('updated');
  });

  it('should get profile photo', async () => {
    (service.findOne as jest.Mock).mockResolvedValue({ profilePic: 'pic.jpg' });
    const result = await controller.getProfilePhoto('1');
    expect(service.findOne).toHaveBeenCalledWith('1', { select: { profilePic: true } });
    expect(result).toEqual({ profilePic: 'pic.jpg' });
  });

  it('should get profile cover photo', async () => {
    (service.findOne as jest.Mock).mockResolvedValue({ coverPic: 'cover.jpg' });
    const result = await controller.getProfileCoverPhoto('1');
    expect(service.findOne).toHaveBeenCalledWith('1', { select: { coverPic: true } });
    expect(result).toEqual({ coverPic: 'cover.jpg' });
  });
});
