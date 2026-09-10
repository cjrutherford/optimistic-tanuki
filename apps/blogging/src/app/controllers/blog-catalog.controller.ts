import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BlogCatalogCommands } from '@optimistic-tanuki/constants';
import {
  BlogCatalogScopeDto,
  CreateBlogCatalogDto,
} from '@optimistic-tanuki/models';
import { BlogCatalogService } from '../services/blog-catalog.service';

@Controller()
export class BlogCatalogController {
  constructor(private readonly catalogService: BlogCatalogService) {}

  @MessagePattern({ cmd: BlogCatalogCommands.CREATE })
  create(
    @Payload()
    data: {
      createCatalogDto: CreateBlogCatalogDto;
      scope: BlogCatalogScopeDto;
    }
  ) {
    return this.catalogService.create(data.createCatalogDto, data.scope);
  }

  @MessagePattern({ cmd: BlogCatalogCommands.FIND_ALL })
  findAll(@Payload() scope: BlogCatalogScopeDto) {
    return this.catalogService.findAll(scope);
  }
}
