import { PostController } from './post.controller';
import { PostService } from '../services';
import { CreateBlogPostDto, BlogPostDto, BlogPostQueryDto, UpdateBlogPostDto } from '@optimistic-tanuki/models';

describe('PostController', () => {
  let controller: PostController;
  let postService: jest.Mocked<PostService>;

  const mockPost: BlogPostDto = {
    id: 'post-1',
    title: 'Test Post',
    content: 'Test Content',
    authorId: 'author-1',
    isDraft: true,
    publishedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockPublishedPost: BlogPostDto = {
    ...mockPost,
    id: 'post-2',
    isDraft: false,
    publishedAt: new Date('2024-01-02'),
  };

  beforeEach(() => {
    postService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      adminUpdate: jest.fn(),
      remove: jest.fn(),
      findPublished: jest.fn(),
      findDraftsByAuthor: jest.fn(),
      publish: jest.fn(),
    } as unknown as jest.Mocked<PostService>;
    
    controller = new PostController(postService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPost', () => {
    it('should create a new post', async () => {
      const createDto: CreateBlogPostDto = {
        title: 'New Post',
        content: 'Content',
        authorId: 'author-1',
      };
      postService.create.mockResolvedValue(mockPost);

      const result = await controller.createPost(createDto);

      expect(postService.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockPost);
    });

    it('should create a draft post', async () => {
      const createDto: CreateBlogPostDto = {
        title: 'New Post',
        content: 'Content',
        authorId: 'author-1',
        isDraft: true,
      };
      postService.create.mockResolvedValue(mockPost);

      const result = await controller.createPost(createDto);

      expect(postService.create).toHaveBeenCalledWith(createDto);
      expect(result.isDraft).toBe(true);
    });
  });

  describe('findAllPosts', () => {
    it('should return all posts matching query', async () => {
      const query: BlogPostQueryDto = {};
      postService.findAll.mockResolvedValue([mockPost, mockPublishedPost]);

      const result = await controller.findAllPosts(query);

      expect(postService.findAll).toHaveBeenCalledWith(query);
      expect(result).toHaveLength(2);
    });

    it('should filter posts by isDraft', async () => {
      const query: BlogPostQueryDto = { isDraft: true };
      postService.findAll.mockResolvedValue([mockPost]);

      const result = await controller.findAllPosts(query);

      expect(postService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual([mockPost]);
    });
  });

  describe('findOnePost', () => {
    it('should return a single post by id', async () => {
      postService.findOne.mockResolvedValue(mockPost);

      const result = await controller.findOnePost('post-1');

      expect(postService.findOne).toHaveBeenCalledWith('post-1');
      expect(result).toEqual(mockPost);
    });
  });

  describe('updatePost', () => {
    it('should update a post with required ownership check', async () => {
      const updateDto: UpdateBlogPostDto = { id: 'post-1', title: 'Updated Title' };
      const updatedPost = { ...mockPost, title: 'Updated Title' };
      postService.update.mockResolvedValue(updatedPost);

      const result = await controller.updatePost({ 
        id: 'post-1', 
        updatePostDto: updateDto,
        requestingAuthorId: 'author-1'
      });

      expect(postService.update).toHaveBeenCalledWith('post-1', updateDto, 'author-1');
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('deletePost', () => {
    it('should delete a post', async () => {
      postService.remove.mockResolvedValue(undefined);

      await controller.deletePost('post-1');

      expect(postService.remove).toHaveBeenCalledWith('post-1');
    });
  });

  describe('findPublishedPosts', () => {
    it('should return only published posts', async () => {
      postService.findPublished.mockResolvedValue([mockPublishedPost]);

      const result = await controller.findPublishedPosts();

      expect(postService.findPublished).toHaveBeenCalled();
      expect(result).toEqual([mockPublishedPost]);
      expect(result.every(p => p.isDraft === false)).toBe(true);
    });
  });

  describe('findDraftsByAuthor', () => {
    it('should return drafts for a specific author', async () => {
      postService.findDraftsByAuthor.mockResolvedValue([mockPost]);

      const result = await controller.findDraftsByAuthor('author-1');

      expect(postService.findDraftsByAuthor).toHaveBeenCalledWith('author-1');
      expect(result).toEqual([mockPost]);
    });
  });

  describe('publishPost', () => {
    it('should publish a draft post', async () => {
      postService.publish.mockResolvedValue(mockPublishedPost);

      const result = await controller.publishPost({ id: 'post-1', requestingAuthorId: 'author-1' });

      expect(postService.publish).toHaveBeenCalledWith('post-1', 'author-1');
      expect(result.isDraft).toBe(false);
      expect(result.publishedAt).toBeDefined();
    });
  });
});
