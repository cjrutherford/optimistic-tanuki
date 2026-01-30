import { Test, TestingModule } from '@nestjs/testing';
import { BlogController } from './blog.controller';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { Logger } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { of } from 'rxjs';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';

import { BlogCommands } from '@optimistic-tanuki/constants';

describe('BlogController', () => {
  let controller: BlogController;
  let blogService: any;

  beforeEach(async () => {
    blogService = {
      send: jest.fn(),
      connect: jest.fn().mockResolvedValue(null),
      close: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlogController],
      providers: [
        {
          provide: ServiceTokens.BLOG_SERVICE,
          useValue: blogService,
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

    controller = module.get<BlogController>(BlogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a blog', async () => {
    const dto: any = { title: 'Test' };
    blogService.send.mockReturnValue(of(dto));
    await controller.createBlog(dto);
    expect(blogService.send).toHaveBeenCalledWith(
      { cmd: BlogCommands.CREATE },
      dto
    );
  });

  it('should find all blogs', async () => {
    const query: any = {};
    blogService.send.mockReturnValue(of([]));
    await controller.findAllBlogs(query);
    expect(blogService.send).toHaveBeenCalledWith(
      { cmd: BlogCommands.FIND_ALL },
      query
    );
  });

  it('should get a blog', async () => {
    blogService.send.mockReturnValue(of({ id: '1' }));
    await controller.getBlog('1');
    expect(blogService.send).toHaveBeenCalledWith(
      { cmd: BlogCommands.FIND },
      '1'
    );
  });

  it('should update a blog', async () => {
    const dto: any = { title: 'Updated' };
    blogService.send.mockReturnValue(of({ id: '1', ...dto }));
    await controller.updateBlog('1', dto);
    expect(blogService.send).toHaveBeenCalledWith(
      { cmd: BlogCommands.UPDATE },
      { id: '1', updateBlogDto: dto }
    );
  });

  it('should delete a blog', async () => {
    blogService.send.mockReturnValue(of({}));
    await controller.deleteBlog('1');
    expect(blogService.send).toHaveBeenCalledWith(
      { cmd: BlogCommands.DELETE },
      '1'
    );
  });

  it('should get sitemap', async () => {
    const res: any = {
      set: jest.fn(),
      send: jest.fn(),
    };
    blogService.send.mockReturnValue(of('<xml></xml>'));
    await controller.getSitemap(res);
    expect(blogService.send).toHaveBeenCalledWith(
      { cmd: BlogCommands.GENERATE_SITEMAP },
      { baseUrl: 'https://blog.optimistic-tanuki.com' }
    );
  });
});
