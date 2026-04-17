import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import {
  CreateBlogComponentDto,
  UpdateBlogComponentDto,
  BlogComponentQueryDto,
} from '@optimistic-tanuki/models';
import { BlogComponent, Post } from '../entities';
import { BlogComponentService } from './blog-component.service';
import { Repository } from 'typeorm';

describe('BlogComponentService', () => {
  let service: BlogComponentService;
  let componentRepo: jest.Mocked<Partial<Repository<BlogComponent>>>;
  let postRepo: jest.Mocked<Partial<Repository<Post>>>;

  const mockComponent: BlogComponent = {
    id: 'component-1',
    blogPostId: 'post-1',
    instanceId: 'instance-1',
    componentType: 'author-profile',
    componentData: { name: 'John Doe', bio: 'Test bio' },
    position: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    post: null,
  } as BlogComponent;

  const mockPost: Post = {
    id: 'post-1',
    title: 'Test Post',
    content: 'Test Content',
    authorId: 'author-1',
    isDraft: true,
    publishedAt: null,
    blog: null,
    components: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as Post;

  beforeEach(() => {
    componentRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      delete: jest.fn(),
    };

    postRepo = {
      findOne: jest.fn(),
    };

    service = new BlogComponentService(
      componentRepo as Repository<BlogComponent>,
      postRepo as Repository<Post>
    );
  });

  describe('create', () => {
    const createDto: CreateBlogComponentDto = {
      blogPostId: 'post-1',
      instanceId: 'instance-1',
      componentType: 'author-profile',
      componentData: { name: 'John Doe', bio: 'Test bio' },
      position: 0,
    };

    it('should create a blog component successfully', async () => {
      postRepo.findOne.mockResolvedValue(mockPost);
      componentRepo.findOne.mockResolvedValue(null); // No existing component
      componentRepo.create.mockReturnValue(mockComponent);
      componentRepo.save.mockResolvedValue(mockComponent);

      const result = await service.create(createDto);

      expect(result).toEqual({
        id: 'component-1',
        blogPostId: 'post-1',
        instanceId: 'instance-1',
        componentType: 'author-profile',
        componentData: { name: 'John Doe', bio: 'Test bio' },
        position: 0,
        createdAt: mockComponent.createdAt,
        updatedAt: mockComponent.updatedAt,
      });
    });

    it('should throw NotFoundException when post does not exist', async () => {
      postRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException when instance ID already exists', async () => {
      postRepo.findOne.mockResolvedValue(mockPost);
      componentRepo.findOne.mockResolvedValue(mockComponent); // Existing component

      await expect(service.create(createDto)).rejects.toThrow(RpcException);
    });
  });

  describe('findByPostId', () => {
    it('should return components for a post', async () => {
      componentRepo.find.mockResolvedValue([mockComponent]);

      const result = await service.findByPostId('post-1');

      expect(result).toHaveLength(1);
      expect(result[0].blogPostId).toBe('post-1');
      expect(componentRepo.find).toHaveBeenCalledWith({
        where: { blogPostId: 'post-1' },
        order: { position: 'ASC', createdAt: 'ASC' },
      });
    });

    it('should return empty array when no components found', async () => {
      componentRepo.find.mockResolvedValue([]);

      const result = await service.findByPostId('post-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return a component by id', async () => {
      componentRepo.findOne.mockResolvedValue(mockComponent);

      const result = await service.findOne('component-1');

      expect(result.id).toBe('component-1');
    });

    it('should throw NotFoundException when component not found', async () => {
      componentRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('component-1')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateBlogComponentDto = {
      componentData: { name: 'Jane Doe', bio: 'Updated bio' },
      position: 1,
    };

    it('should update a component successfully', async () => {
      const updatedComponent = { ...mockComponent, ...updateDto };
      componentRepo.findOne.mockResolvedValue(mockComponent);
      componentRepo.save.mockResolvedValue(updatedComponent);

      const result = await service.update('component-1', updateDto);

      expect(result.componentData).toEqual(updateDto.componentData);
      expect(result.position).toBe(updateDto.position);
    });

    it('should throw NotFoundException when component not found', async () => {
      componentRepo.findOne.mockResolvedValue(null);

      await expect(service.update('component-1', updateDto)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('remove', () => {
    it('should remove a component successfully', async () => {
      componentRepo.findOne.mockResolvedValue(mockComponent);
      componentRepo.remove.mockResolvedValue(undefined);

      await service.remove('component-1');

      expect(componentRepo.remove).toHaveBeenCalledWith(mockComponent);
    });

    it('should throw NotFoundException when component not found', async () => {
      componentRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('component-1')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('removeByPostId', () => {
    it('should remove all components for a post', async () => {
      componentRepo.delete.mockResolvedValue(undefined);

      await service.removeByPostId('post-1');

      expect(componentRepo.delete).toHaveBeenCalledWith({
        blogPostId: 'post-1',
      });
    });
  });

  describe('findByQuery', () => {
    it('should find components by query parameters', async () => {
      const query: BlogComponentQueryDto = {
        blogPostId: 'post-1',
        componentType: 'author-profile',
      };
      componentRepo.find.mockResolvedValue([mockComponent]);

      const result = await service.findByQuery(query);

      expect(result).toHaveLength(1);
      expect(componentRepo.find).toHaveBeenCalledWith({
        where: {
          blogPostId: 'post-1',
          componentType: 'author-profile',
        },
        order: { position: 'ASC', createdAt: 'ASC' },
      });
    });
  });
});
