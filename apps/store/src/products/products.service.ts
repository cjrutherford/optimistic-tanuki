import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto, UpdateProductDto } from '@optimistic-tanuki/models';
import { CatalogEntity } from '../catalog/entities/catalog.entity';
import { ProductEntity } from './entities/product.entity';
import type {
  ProductListQuery,
  ProductReadQuery,
  ProductScope,
} from './products.controller';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(CatalogEntity)
    private readonly catalogRepository: Repository<CatalogEntity>
  ) {}

  async create(
    data:
      | {
          createProductDto: CreateProductDto;
          scope: ProductScope;
        }
      | CreateProductDto
  ): Promise<ProductEntity> {
    const createProductDto =
      'createProductDto' in data ? data.createProductDto : data;
    const scope = 'scope' in data ? data.scope : undefined;
    if (createProductDto.catalogId && scope) {
      await this.assertCatalogExists(createProductDto.catalogId, scope);
    }
    const product = this.productRepository.create({
      ...createProductDto,
      ownerId: scope?.ownerId ?? createProductDto.ownerId ?? null,
    });
    return this.productRepository.save(product);
  }

  async findAll(query: ProductListQuery): Promise<ProductEntity[]> {
    if (query.public) {
      if (!query.catalogId) {
        throw new BadRequestException(
          'A catalog is required for public product reads'
        );
      }
      return this.productRepository.find({
        where: { active: true, catalogId: query.catalogId },
      });
    }
    if (!query.ownerId) {
      throw new BadRequestException('An owner scope is required');
    }
    return this.productRepository.find({
      where: query.catalogId
        ? { active: true, ownerId: query.ownerId, catalogId: query.catalogId }
        : { active: true, ownerId: query.ownerId },
    });
  }

  async findOwnerProducts(scope: ProductScope): Promise<ProductEntity[]> {
    if (!scope.ownerId) {
      throw new BadRequestException('An owner scope is required');
    }
    return this.productRepository.find({
      where: { ownerId: scope.ownerId },
    });
  }

  async findOne(query: ProductReadQuery): Promise<ProductEntity> {
    if (query.public) {
      if (!query.catalogId) {
        throw new BadRequestException(
          'A catalog is required for public product reads'
        );
      }
      return this.productRepository.findOne({
        where: { id: query.id, catalogId: query.catalogId, active: true },
      });
    }
    if (!query.ownerId) {
      throw new BadRequestException('An owner scope is required');
    }
    return this.productRepository.findOne({
      where: { id: query.id, ownerId: query.ownerId },
    });
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    scope: ProductScope
  ): Promise<ProductEntity> {
    if (updateProductDto.catalogId) {
      await this.assertCatalogExists(updateProductDto.catalogId, scope);
    }
    await this.productRepository.update(
      { id, ownerId: scope.ownerId },
      updateProductDto
    );
    return this.findOne({ id, ...scope });
  }

  async remove(id: string, scope: ProductScope): Promise<void> {
    await this.productRepository.delete({ id, ownerId: scope.ownerId });
  }

  private async assertCatalogExists(
    catalogId: string,
    scope: ProductScope
  ): Promise<void> {
    const catalog = await this.catalogRepository.findOne({
      where: {
        id: catalogId,
        ownerId: scope.ownerId,
        workspaceId: scope.workspaceId,
        appScope: scope.appScope,
      },
    });
    if (!catalog) {
      throw new BadRequestException(
        'The selected catalog does not belong to the resolved workspace'
      );
    }
  }
}
