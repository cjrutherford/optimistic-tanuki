import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CatalogCommands } from '@optimistic-tanuki/constants';
import {
  CreateStoreCatalogDto,
  StoreCatalogScopeDto,
} from '@optimistic-tanuki/models';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @MessagePattern(CatalogCommands.CREATE_STORE_CATALOG)
  create(
    @Payload()
    data: {
      createCatalogDto: CreateStoreCatalogDto;
      scope: StoreCatalogScopeDto;
    }
  ) {
    return this.catalogService.create(data.createCatalogDto, data.scope);
  }

  @MessagePattern(CatalogCommands.FIND_STORE_CATALOGS)
  findAll(@Payload() scope: StoreCatalogScopeDto) {
    return this.catalogService.findAll(scope);
  }
}
