import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityService, CreateActivityData } from './activity.service';
import { Activity, ActivityType } from '../../entities/activity.entity';
import { SavedItem } from '../../entities/saved-item.entity';

describe('ActivityService', () => {
  let service: ActivityService;
  let activityRepo: jest.Mocked<Repository<Activity>>;
  let savedItemRepo: jest.Mocked<Repository<SavedItem>>;

  const mockActivityRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  const mockSavedItemRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        {
          provide: getRepositoryToken(Activity),
          useValue: mockActivityRepo,
        },
        {
          provide: getRepositoryToken(SavedItem),
          useValue: mockSavedItemRepo,
        },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
    activityRepo = module.get(getRepositoryToken(Activity));
    savedItemRepo = module.get(getRepositoryToken(SavedItem));

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createActivity', () => {
    it('should create and save a new activity', async () => {
      const createData: CreateActivityData = {
        profileId: 'profile-1',
        type: ActivityType.POST,
        description: 'Created a new post',
        resourceId: 'post-1',
        resourceType: 'post',
      };

      const mockActivity = {
        id: 'activity-1',
        ...createData,
        createdAt: new Date(),
      };

      activityRepo.create.mockReturnValue(mockActivity as Activity);
      activityRepo.save.mockResolvedValue(mockActivity as Activity);

      const result = await service.createActivity(createData);

      expect(activityRepo.create).toHaveBeenCalledWith(createData);
      expect(activityRepo.save).toHaveBeenCalledWith(mockActivity);
      expect(result).toEqual(mockActivity);
    });

    it('should create activity without optional fields', async () => {
      const createData: CreateActivityData = {
        profileId: 'profile-1',
        type: ActivityType.LIKE,
        description: 'Liked a post',
      };

      const mockActivity = {
        id: 'activity-2',
        ...createData,
        createdAt: new Date(),
      };

      activityRepo.create.mockReturnValue(mockActivity as Activity);
      activityRepo.save.mockResolvedValue(mockActivity as Activity);

      const result = await service.createActivity(createData);

      expect(result).toEqual(mockActivity);
    });
  });

  describe('findByProfile', () => {
    it('should find activities for a profile with default options', async () => {
      const profileId = 'profile-1';
      const mockActivities = [
        {
          id: 'activity-1',
          profileId,
          type: ActivityType.POST,
          description: 'Created post',
          createdAt: new Date(),
        },
        {
          id: 'activity-2',
          profileId,
          type: ActivityType.COMMENT,
          description: 'Commented on post',
          createdAt: new Date(),
        },
      ];

      activityRepo.find.mockResolvedValue(mockActivities as Activity[]);

      const result = await service.findByProfile(profileId);

      expect(activityRepo.find).toHaveBeenCalledWith({
        where: { profileId },
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual(mockActivities);
    });

    it('should find activities with type filter', async () => {
      const profileId = 'profile-1';
      const options = { type: ActivityType.LIKE, limit: 10, offset: 0 };

      const mockActivities = [
        {
          id: 'activity-1',
          profileId,
          type: ActivityType.LIKE,
          description: 'Liked a post',
          createdAt: new Date(),
        },
      ];

      activityRepo.find.mockResolvedValue(mockActivities as Activity[]);

      const result = await service.findByProfile(profileId, options);

      expect(activityRepo.find).toHaveBeenCalledWith({
        where: { profileId, type: ActivityType.LIKE },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual(mockActivities);
    });

    it('should support pagination', async () => {
      const profileId = 'profile-1';
      const options = { limit: 20, offset: 40 };

      activityRepo.find.mockResolvedValue([]);

      await service.findByProfile(profileId, options);

      expect(activityRepo.find).toHaveBeenCalledWith({
        where: { profileId },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 40,
      });
    });
  });

  describe('findOne', () => {
    it('should find an activity by id', async () => {
      const mockActivity = {
        id: 'activity-1',
        profileId: 'profile-1',
        type: ActivityType.POST,
        description: 'Created post',
        createdAt: new Date(),
      };

      activityRepo.findOne.mockResolvedValue(mockActivity as Activity);

      const result = await service.findOne('activity-1');

      expect(activityRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'activity-1' },
      });
      expect(result).toEqual(mockActivity);
    });

    it('should return null if activity not found', async () => {
      activityRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('deleteActivity', () => {
    it('should delete an activity', async () => {
      activityRepo.delete.mockResolvedValue({ affected: 1 } as any);

      await service.deleteActivity('activity-1');

      expect(activityRepo.delete).toHaveBeenCalledWith('activity-1');
    });
  });

  describe('saveItem', () => {
    it('should save a new item', async () => {
      const profileId = 'profile-1';
      const itemType = 'post' as const;
      const itemId = 'post-1';
      const itemTitle = 'My Post';

      const mockSavedItem = {
        id: 'saved-1',
        profileId,
        itemType,
        itemId,
        itemTitle,
        savedAt: new Date(),
      };

      savedItemRepo.findOne.mockResolvedValue(null);
      savedItemRepo.create.mockReturnValue(mockSavedItem as SavedItem);
      savedItemRepo.save.mockResolvedValue(mockSavedItem as SavedItem);

      const result = await service.saveItem(
        profileId,
        itemType,
        itemId,
        itemTitle
      );

      expect(savedItemRepo.findOne).toHaveBeenCalledWith({
        where: { profileId, itemType, itemId },
      });
      expect(savedItemRepo.create).toHaveBeenCalledWith({
        profileId,
        itemType,
        itemId,
        itemTitle,
      });
      expect(savedItemRepo.save).toHaveBeenCalledWith(mockSavedItem);
      expect(result).toEqual(mockSavedItem);
    });

    it('should return existing saved item if already saved', async () => {
      const profileId = 'profile-1';
      const itemType = 'post' as const;
      const itemId = 'post-1';

      const existingSavedItem = {
        id: 'saved-1',
        profileId,
        itemType,
        itemId,
        savedAt: new Date(),
      };

      savedItemRepo.findOne.mockResolvedValue(existingSavedItem as SavedItem);

      const result = await service.saveItem(profileId, itemType, itemId);

      expect(savedItemRepo.findOne).toHaveBeenCalledWith({
        where: { profileId, itemType, itemId },
      });
      expect(savedItemRepo.create).not.toHaveBeenCalled();
      expect(savedItemRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual(existingSavedItem);
    });

    it('should save item without title', async () => {
      const profileId = 'profile-1';
      const itemType = 'comment' as const;
      const itemId = 'comment-1';

      const mockSavedItem = {
        id: 'saved-1',
        profileId,
        itemType,
        itemId,
        savedAt: new Date(),
      };

      savedItemRepo.findOne.mockResolvedValue(null);
      savedItemRepo.create.mockReturnValue(mockSavedItem as SavedItem);
      savedItemRepo.save.mockResolvedValue(mockSavedItem as SavedItem);

      const result = await service.saveItem(profileId, itemType, itemId);

      expect(result).toEqual(mockSavedItem);
    });
  });

  describe('unsaveItem', () => {
    it('should delete a saved item', async () => {
      const profileId = 'profile-1';
      const itemId = 'post-1';

      savedItemRepo.delete.mockResolvedValue({ affected: 1 } as any);

      await service.unsaveItem(profileId, itemId);

      expect(savedItemRepo.delete).toHaveBeenCalledWith({
        profileId,
        itemId,
      });
    });
  });

  describe('findSavedItems', () => {
    it('should find all saved items for a profile', async () => {
      const profileId = 'profile-1';
      const mockSavedItems = [
        {
          id: 'saved-1',
          profileId,
          itemType: 'post' as const,
          itemId: 'post-1',
          itemTitle: 'Post 1',
          savedAt: new Date('2024-01-01'),
        },
        {
          id: 'saved-2',
          profileId,
          itemType: 'comment' as const,
          itemId: 'comment-1',
          savedAt: new Date('2024-01-02'),
        },
      ];

      savedItemRepo.find.mockResolvedValue(mockSavedItems as SavedItem[]);

      const result = await service.findSavedItems(profileId);

      expect(savedItemRepo.find).toHaveBeenCalledWith({
        where: { profileId },
        order: { savedAt: 'DESC' },
      });
      expect(result).toEqual(mockSavedItems);
    });

    it('should return empty array if no saved items', async () => {
      savedItemRepo.find.mockResolvedValue([]);

      const result = await service.findSavedItems('profile-1');

      expect(result).toEqual([]);
    });
  });

  describe('isItemSaved', () => {
    it('should return true if item is saved', async () => {
      const profileId = 'profile-1';
      const itemId = 'post-1';

      const mockSavedItem = {
        id: 'saved-1',
        profileId,
        itemType: 'post' as const,
        itemId,
        savedAt: new Date(),
      };

      savedItemRepo.findOne.mockResolvedValue(mockSavedItem as SavedItem);

      const result = await service.isItemSaved(profileId, itemId);

      expect(savedItemRepo.findOne).toHaveBeenCalledWith({
        where: { profileId, itemId },
      });
      expect(result).toEqual({ saved: true });
    });

    it('should return false if item is not saved', async () => {
      savedItemRepo.findOne.mockResolvedValue(null);

      const result = await service.isItemSaved('profile-1', 'post-1');

      expect(result).toEqual({ saved: false });
    });
  });
});
