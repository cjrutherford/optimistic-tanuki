import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { ServiceTokens, BlogPostCommands } from '@optimistic-tanuki/constants';
import { Logger, HttpException } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { of, throwError } from 'rxjs';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';

describe('PostController', () => {
  let controller: PostController;
  let mockBlogService: {
    send: jest.Mock;
    connect: jest.Mock;
    close: jest.Mock;
  };

  const mockUser = {
    email: 'test@example.com',
    exp: Date.now() + 3600,
    iat: Date.now(),
    name: 'Test User',
    userId: 'user-1',
    profileId: 'profile-1',
  };

  const mockPost = {
    id: 'post-1',
    title: 'Test Post',
    content: 'Test Content',
    authorId: 'profile-1',
    isDraft: true,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPublishedPost = {
    ...mockPost,
    isDraft: false,
    publishedAt: new Date(),
  };

  beforeEach(async () => {
    mockBlogService = {
      send: jest.fn(),
      connect: jest.fn().mockResolvedValue(null),
      close: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [
        {
          provide: ServiceTokens.BLOG_SERVICE,
          useValue: mockBlogService,
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
        AuthGuard,
        PermissionsGuard,
        Reflector,
        JwtService,
        {
          provide: ServiceTokens.AUTHENTICATION_SERVICE,
          useValue: {
            send: jest.fn().mockReturnValue(of({ isValid: true })),
          },
        },
        {
          provide: ServiceTokens.PERMISSIONS_SERVICE,
          useValue: {
            send: jest.fn().mockReturnValue(of(true)),
          },
        },
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: {
            send: jest.fn().mockReturnValue(of([{ appScope: 'global' }])),
          },
        },
        {
          provide: PermissionsCacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            invalidateProfile: jest.fn().mockResolvedValue(undefined),
            invalidateAppScope: jest.fn().mockResolvedValue(undefined),
            clear: jest.fn().mockResolvedValue(undefined),
            getStats: jest.fn().mockResolvedValue({}),
            cleanupExpired: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
    .overrideGuard(AuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(PermissionsGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<PostController>(PostController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPublishedPosts', () => {
    it('should return published posts', async () => {
      mockBlogService.send.mockReturnValue(of([mockPublishedPost]));
      
      const result = await controller.getPublishedPosts();
      
      expect(mockBlogService.send).toHaveBeenCalledWith(
        { cmd: BlogPostCommands.FIND_PUBLISHED },
        {}
      );
      expect(result).toEqual([mockPublishedPost]);
    });

    it('should throw HttpException on error', async () => {
      mockBlogService.send.mockReturnValue(throwError(() => new Error('Service error')));
      
      await expect(controller.getPublishedPosts()).rejects.toThrow(HttpException);
    });
  });

  describe('getDraftsByAuthor', () => {
    it('should return drafts for the specified author', async () => {
      mockBlogService.send.mockReturnValue(of([mockPost]));
      
      const result = await controller.getDraftsByAuthor('profile-1');
      
      expect(mockBlogService.send).toHaveBeenCalledWith(
        { cmd: BlogPostCommands.FIND_DRAFTS_BY_AUTHOR },
        'profile-1'
      );
      expect(result).toEqual([mockPost]);
    });

    it('should throw HttpException on error', async () => {
      mockBlogService.send.mockReturnValue(throwError(() => new Error('Service error')));
      
      await expect(controller.getDraftsByAuthor('profile-1')).rejects.toThrow(HttpException);
    });
  });

  describe('publishPost', () => {
    it('should publish a draft post', async () => {
      mockBlogService.send.mockReturnValue(of(mockPublishedPost));
      
      const result = await controller.publishPost('post-1', mockUser);
      
      expect(mockBlogService.send).toHaveBeenCalledWith(
        { cmd: BlogPostCommands.PUBLISH },
        { id: 'post-1', requestingAuthorId: 'profile-1' }
      );
      expect(result).toEqual(mockPublishedPost);
    });

    it('should throw HttpException when profileId is missing', async () => {
      const userWithoutProfile = { ...mockUser, profileId: '' };
      
      await expect(controller.publishPost('post-1', userWithoutProfile)).rejects.toThrow(HttpException);
    });

    it('should throw HttpException on error', async () => {
      mockBlogService.send.mockReturnValue(throwError(() => new Error('Service error')));
      
      await expect(controller.publishPost('post-1', mockUser)).rejects.toThrow(HttpException);
    });
  });

  describe('updatePost', () => {
    it('should update a post with requestingAuthorId', async () => {
      const updateData = { id: 'post-1', title: 'Updated Title' };
      mockBlogService.send.mockReturnValue(of({ ...mockPost, title: 'Updated Title' }));
      
      const result = await controller.updatePost('post-1', updateData, mockUser);
      
      expect(mockBlogService.send).toHaveBeenCalledWith(
        { cmd: BlogPostCommands.UPDATE },
        { id: 'post-1', updatePostDto: updateData, requestingAuthorId: 'profile-1' }
      );
      expect(result.title).toBe('Updated Title');
    });

    it('should throw HttpException when profileId is missing', async () => {
      const userWithoutProfile = { ...mockUser, profileId: '' };
      const updateData = { id: 'post-1', title: 'Updated Title' };
      
      await expect(controller.updatePost('post-1', updateData, userWithoutProfile)).rejects.toThrow(HttpException);
    });
  });
});
