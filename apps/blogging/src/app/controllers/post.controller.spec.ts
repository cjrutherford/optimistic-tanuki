jest.mock('isomorphic-dompurify', () => ({
  sanitize: jest.fn((content) => content),
}));

import { PostController } from './post.controller';
import { PostService, RssService, SeoService } from '../services';
import {
  CreateBlogPostDto,
  BlogPostDto,
  BlogPostQueryDto,
  UpdateBlogPostDto,
} from '@optimistic-tanuki/models';

describe('PostController', () => {
  let controller: PostController;
  let postService: jest.Mocked<PostService>;
  let rssService: jest.Mocked<RssService>;
  let seoService: jest.Mocked<SeoService>;

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
      searchPosts: jest.fn(),
    } as unknown as jest.Mocked<PostService>;

    rssService = {
      generateRssFeed: jest.fn(),
    } as unknown as jest.Mocked<RssService>;

    seoService = {
      generatePostMetadata: jest.fn(),
      generateBlogMetadata: jest.fn(),
    } as unknown as jest.Mocked<SeoService>;

    controller = new PostController(postService, rssService, seoService);
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
    it('forwards resolved workspace scope when updating a post', async () => {
      const updateDto: UpdateBlogPostDto = {
        id: 'post-1',
        title: 'Updated Title',
      };
      const workspaceScope = {
        ownerId: 'author-1',
        workspaceId: 'workspace-1',
        appScope: 'business-site',
      };
      postService.update.mockResolvedValue({ ...mockPost, ...updateDto });

      await controller.updatePost({
        id: 'post-1',
        updatePostDto: updateDto,
        requestingAuthorId: 'author-1',
        workspaceScope,
      } as any);

      expect(postService.update).toHaveBeenCalledWith(
        'post-1',
        updateDto,
        'author-1',
        workspaceScope
      );
    });

    it('should update a post with required ownership check', async () => {
      const updateDto: UpdateBlogPostDto = {
        id: 'post-1',
        title: 'Updated Title',
      };
      const updatedPost = { ...mockPost, title: 'Updated Title' };
      postService.update.mockResolvedValue(updatedPost);

      const result = await controller.updatePost({
        id: 'post-1',
        updatePostDto: updateDto,
        requestingAuthorId: 'author-1',
      });

      expect(postService.update).toHaveBeenCalledWith(
        'post-1',
        updateDto,
        'author-1'
      );
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('deletePost', () => {
    it('forwards resolved workspace scope when deleting a post', async () => {
      const workspaceScope = {
        ownerId: 'author-1',
        workspaceId: 'workspace-1',
        appScope: 'business-site',
      };
      postService.remove.mockResolvedValue(undefined);

      await controller.deletePost({
        id: 'post-1',
        workspaceScope,
      } as any);

      expect(postService.remove).toHaveBeenCalledWith('post-1', workspaceScope);
    });

    it('should delete a post', async () => {
      postService.remove.mockResolvedValue(undefined);

      await controller.deletePost('post-1');

      expect(postService.remove).toHaveBeenCalledWith('post-1');
    });
  });

  describe('findPublishedPosts', () => {
    it('should return a safe catalog-only compatibility projection', async () => {
      postService.findPublished.mockResolvedValue([mockPublishedPost]);

      const result = await controller.findPublishedPosts({
        catalogId: 'catalog-north',
      });

      expect(postService.findPublished).toHaveBeenCalledWith({
        catalogId: 'catalog-north',
      });
      expect(result).toEqual([
        {
          id: mockPublishedPost.id,
          title: mockPublishedPost.title,
          content: mockPublishedPost.content,
          publishedAt: mockPublishedPost.publishedAt,
        },
      ]);
      expect(result[0]).not.toHaveProperty('authorId');
      expect(result[0]).not.toHaveProperty('isDraft');
    });

    it('preserves the legacy global published query when no catalog is supplied', async () => {
      postService.findPublished.mockResolvedValue([mockPublishedPost]);

      await controller.findPublishedPosts({});

      expect(postService.findPublished).toHaveBeenCalledWith({});
    });

    it('requires all private scope fields for the canonical command', async () => {
      await expect(
        controller.findScopedPublishedPosts({ catalogId: 'catalog-north' })
      ).rejects.toThrow('catalogId, workspaceId, and appScope are required');
      expect(postService.findPublished).not.toHaveBeenCalled();
    });
  });

  describe('findDraftsByAuthor', () => {
    it('forwards resolved workspace scope when listing drafts', async () => {
      const workspaceScope = {
        ownerId: 'author-1',
        workspaceId: 'workspace-1',
        appScope: 'business-site',
      };
      postService.findDraftsByAuthor.mockResolvedValue([mockPost]);

      await controller.findDraftsByAuthor({
        authorId: 'author-1',
        workspaceScope,
      } as any);

      expect(postService.findDraftsByAuthor).toHaveBeenCalledWith(
        'author-1',
        workspaceScope
      );
    });

    it('should return drafts for a specific author', async () => {
      postService.findDraftsByAuthor.mockResolvedValue([mockPost]);

      const result = await controller.findDraftsByAuthor('author-1');

      expect(postService.findDraftsByAuthor).toHaveBeenCalledWith('author-1');
      expect(result).toEqual([mockPost]);
    });
  });

  describe('publishPost', () => {
    it('forwards resolved workspace scope when publishing a post', async () => {
      const workspaceScope = {
        ownerId: 'author-1',
        workspaceId: 'workspace-1',
        appScope: 'business-site',
      };
      postService.publish.mockResolvedValue(mockPublishedPost);

      await controller.publishPost({
        id: 'post-1',
        requestingAuthorId: 'author-1',
        workspaceScope,
      } as any);

      expect(postService.publish).toHaveBeenCalledWith(
        'post-1',
        'author-1',
        workspaceScope
      );
    });

    it('should publish a draft post', async () => {
      postService.publish.mockResolvedValue(mockPublishedPost);

      const result = await controller.publishPost({
        id: 'post-1',
        requestingAuthorId: 'author-1',
      });

      expect(postService.publish).toHaveBeenCalledWith('post-1', 'author-1');
      expect(result.isDraft).toBe(false);
      expect(result.publishedAt).toBeDefined();
    });
  });

  describe('generateRssFeed', () => {
    it('should generate RSS feed for published posts', async () => {
      const blogInfo = {
        title: 'Blog',
        description: 'Desc',
        link: 'url',
        feedUrl: 'feed',
      };
      postService.findPublished.mockResolvedValue([mockPublishedPost]);
      rssService.generateRssFeed.mockReturnValue('rss-xml');

      const result = await controller.generateRssFeed({ blogInfo });

      expect(postService.findPublished).toHaveBeenCalled();
      expect(rssService.generateRssFeed).toHaveBeenCalledWith(
        [mockPublishedPost],
        blogInfo
      );
      expect(result).toBe('rss-xml');
    });
  });

  describe('generateSeoMetadata', () => {
    it('should generate SEO metadata for a post', async () => {
      postService.findOne.mockResolvedValue(mockPublishedPost);
      const mockSeo = {
        title: 'SEO',
        description: 'Desc',
        keywords: [],
        url: 'url',
        image: 'img',
      };
      seoService.generatePostMetadata.mockReturnValue(mockSeo as any);

      const result = await controller.generateSeoMetadata({
        postId: 'post-2',
        baseUrl: 'url',
      });

      expect(postService.findOne).toHaveBeenCalledWith('post-2');
      expect(seoService.generatePostMetadata).toHaveBeenCalledWith(
        mockPublishedPost,
        'url',
        undefined
      );
      expect(result).toEqual(mockSeo);
    });

    it('should throw error if post not found for SEO', async () => {
      postService.findOne.mockResolvedValue(null);

      await expect(
        controller.generateSeoMetadata({ postId: 'none', baseUrl: 'url' })
      ).rejects.toThrow('Post not found');
    });
  });

  describe('searchPosts', () => {
    it('should search posts by term', async () => {
      postService.searchPosts.mockResolvedValue([mockPublishedPost]);

      const result = await controller.searchPosts({ searchTerm: 'test' });

      expect(postService.searchPosts).toHaveBeenCalledWith('test');
      expect(result).toEqual([mockPublishedPost]);
    });
  });
});
