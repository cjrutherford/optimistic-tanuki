import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  Optional,
} from '@nestjs/common';
import { Response } from 'express';
import { ClientProxy } from '@nestjs/microservices';
import {
  BlogCatalogCommands,
  BlogCommands,
  BlogPostCommands,
  AppConfigCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { resolvePublishedBlogCatalogId } from '@optimistic-tanuki/configurable-plugin-contracts';
import {
  BlogQueryDto,
  CreateBlogDto,
  UpdateBlogDto,
  CreateBlogCatalogDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';
import { WorkspaceContext } from '../../decorators/workspace-context.decorator';
import { WorkspaceContextGuard } from '../../guards/workspace-context.guard';
import type { PublishedAppConfiguration } from '@optimistic-tanuki/app-config-models';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('blog')
export class BlogController {
  constructor(
    @Inject(ServiceTokens.BLOG_SERVICE)
    private readonly blogService: ClientProxy,
    private readonly l: Logger,
    @Optional()
    @Inject(ServiceTokens.APP_CONFIGURATOR_SERVICE)
    private readonly appConfigService?: ClientProxy
  ) {
    this.l.log('BlogController initialized');
    console.log('BlogController connecting to blogService...');
    this.blogService
      .connect()
      .then(() => {
        this.l.log('BlogController connected to blogService');
      })
      .catch((e) => this.l.error('Error connecting to blogService', e));
  }

  private catalogScope(request: any) {
    const workspace = request.workspaceContext?.workspace;
    if (!workspace) {
      throw new HttpException('A resolved workspace is required', 400);
    }
    return {
      ownerId: workspace.ownerProfileId,
      workspaceId: workspace.workspaceId,
      appScope: workspace.appScope,
    };
  }

  @RequirePermissions('blog.post.read')
  @WorkspaceContext({
    kind: 'business-site',
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @Get('/catalogs/mine')
  async findMyCatalogs(@Req() request: any) {
    return firstValueFrom(
      this.blogService.send(
        { cmd: BlogCatalogCommands.FIND_ALL },
        this.catalogScope(request)
      )
    );
  }

  @RequirePermissions('blog.post.create')
  @WorkspaceContext({
    kind: 'business-site',
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @Post('/catalogs')
  async createCatalog(
    @Body() createCatalogDto: CreateBlogCatalogDto,
    @Req() request: any
  ) {
    return firstValueFrom(
      this.blogService.send(
        { cmd: BlogCatalogCommands.CREATE },
        { createCatalogDto, scope: this.catalogScope(request) }
      )
    );
  }

  @Post()
  @RequirePermissions('blog.blog.create')
  async createBlog(@Body() createBlog: CreateBlogDto) {
    try {
      const blog = await firstValueFrom(
        this.blogService.send({ cmd: BlogCommands.CREATE }, createBlog)
      );
      this.l.log('Blog created successfully');
      return blog;
    } catch (error) {
      this.l.error('Error creating blog', error);
      throw new HttpException(
        'Failed to create blog: [' + error.message + ']',
        500
      );
    }
  }

  @Post('/find')
  // @RequirePermissions('read:blog', 'view:public')
  async findAllBlogs(@Body() query: BlogQueryDto) {
    try {
      const blogs = await firstValueFrom(
        this.blogService.send({ cmd: BlogCommands.FIND_ALL }, query)
      );
      this.l.log('Blogs retrieved successfully');
      return blogs;
    } catch (error) {
      this.l.error('Error retrieving blogs', error);
      throw new HttpException(
        'Failed to retrieve blogs: [' + error.message + ']',
        500
      );
    }
  }

  @Get('/catalogs/:catalogId/posts')
  @Public()
  async findCatalogPosts(@Param('catalogId') catalogId: string) {
    const normalizedCatalogId = catalogId?.trim();
    if (!normalizedCatalogId) {
      throw new HttpException('A non-empty catalogId is required', 400);
    }
    // Deprecated compatibility route for Business Site. Configurable Client
    // uses findPublishedPostsByDomain(), which is domain-bound and scoped.
    return firstValueFrom(
      this.blogService.send(
        { cmd: BlogPostCommands.FIND_PUBLISHED },
        { catalogId: normalizedCatalogId }
      )
    );
  }

  /**
   * Canonical anonymous Blog read. The browser supplies only the public
   * domain; app-configurator resolves the committed snapshot and private
   * workspace/app scope stays inside the gateway.
   */
  @Get('/by-domain/:domain/posts')
  @Public()
  async findPublishedPostsByDomain(@Param('domain') domain: string) {
    return this.sendScopedPublishedPosts(
      await this.resolvePublicBlogContext(domain)
    );
  }

  private async resolvePublicBlogContext(domain: string): Promise<{
    catalogId: string;
    workspaceId: string;
    appScope: string;
  }> {
    const normalizedDomain = this.normalizePublicDomain(domain);
    if (!normalizedDomain) {
      throw new HttpException('A valid public domain is required', 400);
    }
    if (!this.appConfigService) {
      throw new HttpException(
        'Public Blog domain resolution is unavailable',
        503
      );
    }
    const resolved = (await firstValueFrom(
      this.appConfigService.send(
        { cmd: AppConfigCommands.GetPublishedContextByDomain },
        { domain: normalizedDomain }
      )
    )) as {
      configuration?: Pick<PublishedAppConfiguration, 'manifest'>;
      context?: { workspaceId?: string; appScope?: string };
    };
    const catalogId = resolvePublishedBlogCatalogId(
      resolved?.configuration?.manifest?.capabilities?.['blogging.posts']
    );
    if (!catalogId) {
      throw new HttpException(
        'No published Blog catalog is configured for this domain',
        404
      );
    }
    const workspaceId = resolved?.context?.workspaceId;
    const appScope = resolved?.context?.appScope;
    if (
      typeof workspaceId !== 'string' ||
      !workspaceId.trim() ||
      typeof appScope !== 'string' ||
      !appScope.trim()
    ) {
      throw new HttpException(
        'Published Blog domain context is incomplete',
        503
      );
    }
    return {
      catalogId,
      workspaceId: workspaceId.trim(),
      appScope: appScope.trim(),
    };
  }

  private sendScopedPublishedPosts(context: {
    catalogId: string;
    workspaceId: string;
    appScope: string;
  }) {
    return firstValueFrom(
      this.blogService.send(
        { cmd: BlogPostCommands.FIND_PUBLISHED_SCOPED },
        context
      )
    );
  }

  private normalizePublicDomain(domain: string): string | undefined {
    const normalized = domain?.trim().toLowerCase();
    return normalized &&
      /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
        normalized
      )
      ? normalized
      : undefined;
  }

  @Get('/:id')
  async getBlog(@Param('id') id: string) {
    try {
      const blog = await firstValueFrom(
        this.blogService.send({ cmd: BlogCommands.FIND }, id)
      );
      if (!blog) {
        this.l.error(`Blog ${id} not found`);
        throw new HttpException('Blog not found', 404);
      }
      this.l.log(`Blog ${id} retrieved successfully`);
      return blog;
    } catch (error) {
      this.l.error(`Error retrieving blog ${id}`, error);
      if (error.status === 404) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve blog: [' + error.message + ']',
        500
      );
    }
  }

  @Patch('/:id')
  async updateBlog(@Param('id') id: string, @Body() updateData: UpdateBlogDto) {
    try {
      const updatedBlog = await firstValueFrom(
        this.blogService.send(
          { cmd: BlogCommands.UPDATE },
          { id, updateBlogDto: updateData }
        )
      );
      if (!updatedBlog) {
        throw new HttpException('Blog not found', 404);
      }
      this.l.log(`Blog ${id} updated successfully`);
      return updatedBlog;
    } catch (error) {
      this.l.error(`Error updating blog ${id}`, error);
      if (error.status === 404) {
        throw error;
      }
      throw new HttpException(
        'Failed to update blog: [' + error.message + ']',
        500
      );
    }
  }

  @Delete('/:id')
  async deleteBlog(@Param('id') id: string) {
    try {
      await firstValueFrom(
        this.blogService.send({ cmd: BlogCommands.DELETE }, id)
      );
      this.l.log(`Blog ${id} deleted successfully`);
      return { message: 'Blog deleted successfully' };
    } catch (error) {
      this.l.error(`Error deleting blog ${id}`, error);
      throw new HttpException(
        'Failed to delete blog: [' + error.message + ']',
        500
      );
    }
  }

  /**
   * Generate sitemap XML for all published content
   */
  @Get('/sitemap.xml')
  @Public()
  async getSitemap(@Res() res: Response, @Query('baseUrl') baseUrl?: string) {
    try {
      const defaultBaseUrl = baseUrl || 'https://blog.optimistic-tanuki.com';

      const sitemapXml = await firstValueFrom(
        this.blogService.send(
          { cmd: BlogCommands.GENERATE_SITEMAP },
          { baseUrl: defaultBaseUrl }
        )
      );

      res.set('Content-Type', 'application/xml');
      res.send(sitemapXml);
    } catch (error) {
      this.l.error('Error generating sitemap', error);
      throw new HttpException(
        'Failed to generate sitemap: [' + error.message + ']',
        500
      );
    }
  }
}
