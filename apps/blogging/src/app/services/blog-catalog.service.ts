import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BlogCatalogDto,
  BlogCatalogScopeDto,
  CreateBlogCatalogDto,
} from '@optimistic-tanuki/models';
import { DataSource, Repository } from 'typeorm';
import { BlogCatalog } from '../entities/blog-catalog.entity';
import { Blog } from '../entities/blog.entity';

@Injectable()
export class BlogCatalogService {
  constructor(
    @Inject(getRepositoryToken(BlogCatalog))
    private readonly catalogRepository: Repository<BlogCatalog>,
    @Inject('BLOGGING_CONNECTION')
    private readonly dataSource?: DataSource
  ) {}

  async create(
    createCatalogDto: CreateBlogCatalogDto,
    scope: BlogCatalogScopeDto
  ): Promise<BlogCatalogDto> {
    if (!this.dataSource) {
      throw new Error('The Blogging database connection is required');
    }

    return this.dataSource.transaction(async (manager) => {
      const catalogRepository = manager.getRepository(BlogCatalog);
      const blogRepository = manager.getRepository(Blog);
      const catalog = await catalogRepository.save(
        catalogRepository.create({ ...createCatalogDto, ...scope })
      );

      await blogRepository.save(
        blogRepository.create({
          catalogId: catalog.id,
          name: catalog.name,
          description: catalog.description ?? '',
          ownerId: scope.ownerId,
          workspaceId: scope.workspaceId,
          appScope: scope.appScope,
        })
      );

      return catalog;
    });
  }

  async findAll(scope: BlogCatalogScopeDto): Promise<BlogCatalogDto[]> {
    return this.catalogRepository.find({
      where: scope,
      order: { name: 'ASC' },
    });
  }
}
