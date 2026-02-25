import { Test, TestingModule } from '@nestjs/testing';
import { BlogComponentController } from './blog-component.controller';
import { BlogComponentService } from '../services/blog-component.service';
import { SanitizationService } from '../services/sanitization.service';
import {
  CreateBlogComponentDto,
  UpdateBlogComponentDto,
  BlogComponentQueryDto,
  BlogComponentDto,
} from '@optimistic-tanuki/models';

describe('BlogComponentController', () => {
  let controller: BlogComponentController;
  let service: jest.Mocked<BlogComponentService>;

  const mockComponentDto: BlogComponentDto = {
    id: 'component-1',
    blogPostId: 'post-1',
    instanceId: 'instance-1',
    componentType: 'author-profile',
    componentData: { name: 'John Doe', bio: 'Test bio' },
    position: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockCreateDto: CreateBlogComponentDto = {
    blogPostId: 'post-1',
    instanceId: 'instance-1',
    componentType: 'author-profile',
    componentData: { name: 'John Doe', bio: 'Test bio' },
    position: 0,
  };

  const mockUpdateDto: UpdateBlogComponentDto = {
    componentData: { name: 'Jane Doe', bio: 'Updated bio' },
    position: 1,
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findByPostId: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      removeByPostId: jest.fn(),
      findByQuery: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlogComponentController],
      providers: [
        {
          provide: BlogComponentService,
          useValue: mockService,
        },
        {
          provide: SanitizationService,
          useValue: {
            sanitizeHtml: jest
              .fn()
              .mockImplementation((html: string) => Promise.resolve(html)),
          },
        },
      ],
    }).compile();

    controller = module.get<BlogComponentController>(BlogComponentController);
    service = module.get<BlogComponentService>(
      BlogComponentService
    ) as jest.Mocked<BlogComponentService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createBlogComponent', () => {
    it('should create a blog component', async () => {
      service.create.mockResolvedValue(mockComponentDto);

      const result = await controller.createBlogComponent(mockCreateDto);

      expect(result).toEqual(mockComponentDto);
      expect(service.create).toHaveBeenCalledWith(mockCreateDto);
    });
  });

  describe('getComponentsForPost', () => {
    it('should return components for a post', async () => {
      service.findByPostId.mockResolvedValue([mockComponentDto]);

      const result = await controller.getComponentsForPost('post-1');

      expect(result).toEqual([mockComponentDto]);
      expect(service.findByPostId).toHaveBeenCalledWith('post-1');
    });
  });

  describe('findOneBlogComponent', () => {
    it('should return a single blog component', async () => {
      service.findOne.mockResolvedValue(mockComponentDto);

      const result = await controller.findOneBlogComponent('component-1');

      expect(result).toEqual(mockComponentDto);
      expect(service.findOne).toHaveBeenCalledWith('component-1');
    });
  });

  describe('updateBlogComponent', () => {
    it('should update a blog component', async () => {
      const updatedComponent = { ...mockComponentDto, ...mockUpdateDto };
      service.update.mockResolvedValue(updatedComponent);

      const result = await controller.updateBlogComponent({
        id: 'component-1',
        dto: mockUpdateDto,
      });

      expect(result).toEqual(updatedComponent);
      expect(service.update).toHaveBeenCalledWith('component-1', mockUpdateDto);
    });
  });

  describe('deleteBlogComponent', () => {
    it('should delete a blog component', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.deleteBlogComponent('component-1');

      expect(service.remove).toHaveBeenCalledWith('component-1');
    });
  });

  describe('deleteComponentsByPost', () => {
    it('should delete all components for a post', async () => {
      service.removeByPostId.mockResolvedValue(undefined);

      await controller.deleteComponentsByPost('post-1');

      expect(service.removeByPostId).toHaveBeenCalledWith('post-1');
    });
  });

  describe('findComponentsByQuery', () => {
    it('should find components by query', async () => {
      const query: BlogComponentQueryDto = {
        blogPostId: 'post-1',
        componentType: 'author-profile',
      };
      service.findByQuery.mockResolvedValue([mockComponentDto]);

      const result = await controller.findComponentsByQuery(query);

      expect(result).toEqual([mockComponentDto]);
      expect(service.findByQuery).toHaveBeenCalledWith(query);
    });
  });
});
