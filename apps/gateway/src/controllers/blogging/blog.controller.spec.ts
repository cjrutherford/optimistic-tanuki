import { Test, TestingModule } from '@nestjs/testing';
import { BlogController } from './blog.controller';
import { AppConfigCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { Logger } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { of } from 'rxjs';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';
import { WorkspaceContextGuard } from '../../guards/workspace-context.guard';

import { BlogCommands, BlogPostCommands } from '@optimistic-tanuki/constants';

describe('BlogController', () => {
  let controller: BlogController;
  let blogService: any;
  let appConfigService: any;

  beforeEach(async () => {
    blogService = {
      send: jest.fn(),
      connect: jest.fn().mockResolvedValue(null),
      close: jest.fn(),
    };
    appConfigService = {
      send: jest.fn(),
      connect: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlogController],
      providers: [
        {
          provide: ServiceTokens.BLOG_SERVICE,
          useValue: blogService,
        },
        {
          provide: ServiceTokens.APP_CONFIGURATOR_SERVICE,
          useValue: appConfigService,
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
      .overrideGuard(WorkspaceContextGuard)
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

  it('keeps the deprecated catalog-only Business Site route compatible', async () => {
    blogService.send.mockReturnValue(of([]));

    await (controller as any).findCatalogPosts('catalog-north');

    expect(blogService.send).toHaveBeenCalledWith(
      { cmd: BlogPostCommands.FIND_PUBLISHED },
      { catalogId: 'catalog-north' }
    );
  });

  it('rejects a blank public catalog selector without calling Blogging', async () => {
    await expect((controller as any).findCatalogPosts('  ')).rejects.toThrow(
      'A non-empty catalogId is required'
    );
    expect(blogService.send).not.toHaveBeenCalled();
  });

  it('resolves a committed domain and sends only scoped public Blog context downstream', async () => {
    appConfigService.send.mockReturnValue(
      of({
        configuration: {
          id: 'config-1',
          domain: 'North.Example.com',
          manifest: {
            schemaVersion: 1,
            surfaceType: 'generic',
            capabilities: {
              'blogging.posts': {
                enabled: true,
                placement: 'public-content',
                resourceRef: { type: 'blog-catalog', id: 'catalog-north' },
              },
            },
          },
          publishedVersion: 3,
          active: true,
        },
        context: {
          workspaceId: 'workspace-north',
          appScope: 'configurable-client',
        },
      })
    );
    blogService.send.mockReturnValue(
      of([{ id: 'post-1', title: 'Published' }])
    );

    const result = await (controller as any).findPublishedPostsByDomain(
      'North.Example.com'
    );

    expect(appConfigService.send).toHaveBeenCalledWith(
      { cmd: AppConfigCommands.GetPublishedContextByDomain },
      { domain: 'north.example.com' }
    );
    expect(blogService.send).toHaveBeenCalledWith(
      { cmd: BlogPostCommands.FIND_PUBLISHED_SCOPED },
      {
        catalogId: 'catalog-north',
        workspaceId: 'workspace-north',
        appScope: 'configurable-client',
      }
    );
    expect(result).toEqual([{ id: 'post-1', title: 'Published' }]);
  });

  it.each(['  ', 'not a domain'])(
    'rejects invalid public domains before app resolution',
    async (domain) => {
      await expect(
        (controller as any).findPublishedPostsByDomain(domain)
      ).rejects.toThrow('A valid public domain is required');
      expect(appConfigService.send).not.toHaveBeenCalled();
    }
  );

  it('fails closed when the committed app has no published Blogging resource', async () => {
    appConfigService.send.mockReturnValue(
      of({
        configuration: { manifest: { capabilities: {} }, active: true },
        context: {
          workspaceId: 'workspace-north',
          appScope: 'configurable-client',
        },
      })
    );

    await expect(
      (controller as any).findPublishedPostsByDomain('north.example.com')
    ).rejects.toThrow(
      'No published Blog catalog is configured for this domain'
    );
    expect(blogService.send).not.toHaveBeenCalled();
  });

  it('lists blog catalogs with resolved workspace identity', async () => {
    blogService.send.mockReturnValue(of([]));
    const request = {
      workspaceContext: {
        workspace: {
          ownerProfileId: 'owner-profile',
          workspaceId: 'workspace-id',
          appScope: 'business-site',
        },
      },
    };

    await (controller as any).findMyCatalogs(request);

    expect(blogService.send).toHaveBeenCalledWith(
      { cmd: 'blogCatalog.findAll' },
      {
        ownerId: 'owner-profile',
        workspaceId: 'workspace-id',
        appScope: 'business-site',
      }
    );
  });

  it('creates blog catalogs with resolved workspace identity', async () => {
    blogService.send.mockReturnValue(of({ id: 'catalog-id' }));
    const request = {
      workspaceContext: {
        workspace: {
          ownerProfileId: 'owner-profile',
          workspaceId: 'workspace-id',
          appScope: 'business-site',
        },
      },
    };

    await (controller as any).createCatalog({ name: 'Updates' }, request);

    expect(blogService.send).toHaveBeenCalledWith(
      { cmd: 'blogCatalog.create' },
      expect.objectContaining({
        createCatalogDto: { name: 'Updates' },
        scope: expect.objectContaining({ workspaceId: 'workspace-id' }),
      })
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
