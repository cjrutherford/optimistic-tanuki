import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateBlogPostDto, UpdateBlogPostDto, BlogPostQueryDto } from '@optimistic-tanuki/models';
import { Post } from '../entities';
import { PostService } from './post.service';
import { Repository } from 'typeorm';

describe('PostService', () => {
  let service: PostService;
  let postRepo: jest.Mocked<Partial<Repository<Post>>>;

  const mockPost: Post = {
    id: 'post-1',
    title: 'Test Post',
    content: 'Test Content',
    authorId: 'author-1',
    isDraft: true,
    publishedAt: null,
    blog: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as Post;

  const mockPublishedPost: Post = {
    ...mockPost,
    id: 'post-2',
    isDraft: false,
    publishedAt: new Date('2024-01-02'),
  } as Post;

  beforeEach(() => {
    postRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new PostService(postRepo as Repository<Post>);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a draft post by default', async () => {
      const dto: CreateBlogPostDto = {
        title: 'New Post',
        content: 'Content',
        authorId: 'author-1',
      };
      const createdPost = { ...mockPost, ...dto };
      postRepo.create.mockReturnValue(createdPost as Post);
      postRepo.save.mockResolvedValue(createdPost as Post);

      const result = await service.create(dto);

      expect(postRepo.create).toHaveBeenCalledWith({
        ...dto,
        isDraft: true,
        publishedAt: null,
      });
      expect(postRepo.save).toHaveBeenCalledWith(createdPost);
      expect(result).toEqual(createdPost);
    });

    it('should create a published post when isDraft is false', async () => {
      const dto: CreateBlogPostDto = {
        title: 'New Post',
        content: 'Content',
        authorId: 'author-1',
        isDraft: false,
      };
      const createdPost = { ...mockPublishedPost, ...dto };
      postRepo.create.mockReturnValue(createdPost as Post);
      postRepo.save.mockResolvedValue(createdPost as Post);

      const result = await service.create(dto);

      expect(postRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        ...dto,
        isDraft: false,
      }));
      expect(postRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        publishedAt: expect.any(Date),
      }));
      expect(result).toEqual(createdPost);
    });

    it('should create a draft post when isDraft is explicitly true', async () => {
      const dto: CreateBlogPostDto = {
        title: 'New Post',
        content: 'Content',
        authorId: 'author-1',
        isDraft: true,
      };
      const createdPost = { ...mockPost, ...dto };
      postRepo.create.mockReturnValue(createdPost as Post);
      postRepo.save.mockResolvedValue(createdPost as Post);

      const result = await service.create(dto);

      expect(postRepo.create).toHaveBeenCalledWith({
        ...dto,
        isDraft: true,
        publishedAt: null,
      });
      expect(result).toEqual(createdPost);
    });
  });

  describe('findAll', () => {
    it('should return all posts matching query', async () => {
      const posts = [mockPost, mockPublishedPost];
      postRepo.find.mockResolvedValue(posts);

      const query: BlogPostQueryDto = {};
      const result = await service.findAll(query);

      expect(postRepo.find).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual(posts);
    });

    it('should filter by title', async () => {
      postRepo.find.mockResolvedValue([mockPost]);

      const query: BlogPostQueryDto = { title: 'Test Post' };
      await service.findAll(query);

      expect(postRepo.find).toHaveBeenCalledWith({
        where: { title: 'Test Post' },
      });
    });

    it('should filter by authorId', async () => {
      postRepo.find.mockResolvedValue([mockPost]);

      const query: BlogPostQueryDto = { authorId: 'author-1' };
      await service.findAll(query);

      expect(postRepo.find).toHaveBeenCalledWith({
        where: { authorId: 'author-1' },
      });
    });

    it('should filter by isDraft', async () => {
      postRepo.find.mockResolvedValue([mockPost]);

      const query: BlogPostQueryDto = { isDraft: true };
      await service.findAll(query);

      expect(postRepo.find).toHaveBeenCalledWith({
        where: { isDraft: true },
      });
    });

    it('should filter by content using Like', async () => {
      postRepo.find.mockResolvedValue([mockPost]);

      const query: BlogPostQueryDto = { content: 'test' };
      await service.findAll(query);

      expect(postRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          content: expect.objectContaining({ _value: '%test%' }),
        }),
      });
    });

    it('should filter by date ranges', async () => {
      postRepo.find.mockResolvedValue([mockPost]);
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      const query: BlogPostQueryDto = { 
        createdAt: [startDate, endDate] as unknown as [Date, Date],
        updatedAt: [startDate, endDate] as unknown as [Date, Date],
      };
      await service.findAll(query);

      expect(postRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          createdAt: expect.anything(),
          updatedAt: expect.anything(),
        }),
      });
    });
  });

  describe('findPublished', () => {
    it('should return only published posts ordered by publishedAt DESC', async () => {
      const publishedPosts = [mockPublishedPost];
      postRepo.find.mockResolvedValue(publishedPosts);

      const result = await service.findPublished();

      expect(postRepo.find).toHaveBeenCalledWith({
        where: { isDraft: false },
        order: { publishedAt: 'DESC' },
      });
      expect(result).toEqual(publishedPosts);
    });
  });

  describe('findDraftsByAuthor', () => {
    it('should return drafts for a specific author', async () => {
      const drafts = [mockPost];
      postRepo.find.mockResolvedValue(drafts);

      const result = await service.findDraftsByAuthor('author-1');

      expect(postRepo.find).toHaveBeenCalledWith({
        where: { authorId: 'author-1', isDraft: true },
        order: { updatedAt: 'DESC' },
      });
      expect(result).toEqual(drafts);
    });
  });

  describe('findOne', () => {
    it('should return a single post by id', async () => {
      postRepo.findOne.mockResolvedValue(mockPost);

      const result = await service.findOne('post-1');

      expect(postRepo.findOne).toHaveBeenCalledWith({ where: { id: 'post-1' } });
      expect(result).toEqual(mockPost);
    });

    it('should return null if post not found', async () => {
      postRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a post if requestingAuthorId matches', async () => {
      postRepo.findOne.mockResolvedValue(mockPost);
      postRepo.update.mockResolvedValue(undefined);

      const updateDto: UpdateBlogPostDto = { id: 'post-1', title: 'Updated Title' };
      await service.update('post-1', updateDto, 'author-1');

      expect(postRepo.update).toHaveBeenCalledWith('post-1', expect.objectContaining({ title: 'Updated Title' }));
    });

    it('should throw ForbiddenException if requestingAuthorId does not match', async () => {
      postRepo.findOne.mockResolvedValue(mockPost);

      const updateDto: UpdateBlogPostDto = { id: 'post-1', title: 'Updated Title' };

      await expect(service.update('post-1', updateDto, 'different-author')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if post does not exist', async () => {
      postRepo.findOne.mockResolvedValue(null);

      const updateDto: UpdateBlogPostDto = { id: 'post-1', title: 'Updated Title' };

      await expect(service.update('post-1', updateDto, 'author-1')).rejects.toThrow(NotFoundException);
    });

    it('should set publishedAt when publishing a draft', async () => {
      postRepo.findOne.mockResolvedValueOnce(mockPost).mockResolvedValueOnce({ ...mockPost, isDraft: false, publishedAt: new Date() });
      postRepo.update.mockResolvedValue(undefined);

      const updateDto: UpdateBlogPostDto = { id: 'post-1', isDraft: false };
      await service.update('post-1', updateDto, 'author-1');

      expect(postRepo.update).toHaveBeenCalledWith('post-1', expect.objectContaining({
        isDraft: false,
        publishedAt: expect.any(Date),
      }));
    });

    it('should not update publishedAt if already published', async () => {
      postRepo.findOne.mockResolvedValueOnce(mockPublishedPost).mockResolvedValueOnce(mockPublishedPost);
      postRepo.update.mockResolvedValue(undefined);

      const updateDto: UpdateBlogPostDto = { id: 'post-2', title: 'New Title' };
      await service.update('post-2', updateDto, 'author-1');

      expect(postRepo.update).toHaveBeenCalledWith('post-2', expect.not.objectContaining({
        publishedAt: expect.any(Date),
      }));
    });
  });

  describe('adminUpdate', () => {
    it('should update a post without ownership check', async () => {
      postRepo.findOne.mockResolvedValue(mockPost);
      postRepo.update.mockResolvedValue(undefined);

      const updateDto: UpdateBlogPostDto = { id: 'post-1', title: 'Admin Updated Title' };
      await service.adminUpdate('post-1', updateDto);

      expect(postRepo.update).toHaveBeenCalledWith('post-1', expect.objectContaining({ title: 'Admin Updated Title' }));
    });

    it('should throw NotFoundException if post does not exist', async () => {
      postRepo.findOne.mockResolvedValue(null);

      const updateDto: UpdateBlogPostDto = { id: 'post-1', title: 'Updated Title' };

      await expect(service.adminUpdate('post-1', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should set publishedAt when publishing a draft via admin', async () => {
      postRepo.findOne.mockResolvedValueOnce(mockPost).mockResolvedValueOnce({ ...mockPost, isDraft: false, publishedAt: new Date() });
      postRepo.update.mockResolvedValue(undefined);

      const updateDto: UpdateBlogPostDto = { id: 'post-1', isDraft: false };
      await service.adminUpdate('post-1', updateDto);

      expect(postRepo.update).toHaveBeenCalledWith('post-1', expect.objectContaining({
        isDraft: false,
        publishedAt: expect.any(Date),
      }));
    });
  });

  describe('publish', () => {
    it('should publish a draft post', async () => {
      postRepo.findOne.mockResolvedValueOnce(mockPost).mockResolvedValueOnce({ ...mockPost, isDraft: false, publishedAt: new Date() });
      postRepo.update.mockResolvedValue(undefined);

      const result = await service.publish('post-1', 'author-1');

      expect(postRepo.update).toHaveBeenCalledWith('post-1', {
        isDraft: false,
        publishedAt: expect.any(Date),
      });
      expect(result.isDraft).toBe(false);
    });

    it('should throw NotFoundException if post does not exist', async () => {
      postRepo.findOne.mockResolvedValue(null);

      await expect(service.publish('non-existent', 'author-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if requestingAuthorId does not match', async () => {
      postRepo.findOne.mockResolvedValue(mockPost);

      await expect(service.publish('post-1', 'different-author')).rejects.toThrow(ForbiddenException);
    });

    it('should return post unchanged if already published', async () => {
      postRepo.findOne.mockResolvedValue(mockPublishedPost);

      const result = await service.publish('post-2', 'author-1');

      expect(postRepo.update).not.toHaveBeenCalled();
      expect(result).toEqual(mockPublishedPost);
    });
  });

  describe('remove', () => {
    it('should delete a post', async () => {
      postRepo.delete.mockResolvedValue(undefined);

      await service.remove('post-1');

      expect(postRepo.delete).toHaveBeenCalledWith('post-1');
    });
  });
});
