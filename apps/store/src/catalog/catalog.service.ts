import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  CreateStoreCatalogDto,
  StoreCatalogDto,
  StoreCatalogScopeDto,
} from '@optimistic-tanuki/models';
import { Repository } from 'typeorm';
import { CatalogEntity } from './entities/catalog.entity';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(getRepositoryToken(CatalogEntity))
    private readonly catalogRepository: Repository<CatalogEntity>
  ) {}

  async create(
    createCatalogDto: CreateStoreCatalogDto,
    scope: StoreCatalogScopeDto
  ): Promise<StoreCatalogDto> {
    return this.catalogRepository.save(
      this.catalogRepository.create({ ...createCatalogDto, ...scope })
    );
  }

  async findAll(scope: StoreCatalogScopeDto): Promise<StoreCatalogDto[]> {
    return this.catalogRepository.find({
      where: scope,
      order: { name: 'ASC' },
    });
  }
}
