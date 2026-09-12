import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductCommands } from '@optimistic-tanuki/constants';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from '@optimistic-tanuki/models';

@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @MessagePattern(ProductCommands.CREATE_PRODUCT)
  create(
    @Payload()
    data: {
      createProductDto: CreateProductDto;
      scope: ProductScope;
    }
  ) {
    return this.productsService.create(data);
  }

  @MessagePattern(ProductCommands.FIND_ALL_PRODUCTS)
  findAll(@Payload() payload: ProductListQuery = {}) {
    return this.productsService.findAll(payload);
  }

  @MessagePattern(ProductCommands.FIND_OWNER_PRODUCTS)
  findOwnerProducts(@Payload() scope: ProductScope) {
    return this.productsService.findOwnerProducts(scope);
  }

  @MessagePattern(ProductCommands.FIND_ONE_PRODUCT)
  findOne(@Payload() payload: ProductReadQuery) {
    return this.productsService.findOne(payload);
  }

  @MessagePattern(ProductCommands.UPDATE_PRODUCT)
  update(
    @Payload()
    data: {
      id: string;
      updateProductDto: UpdateProductDto;
      scope: ProductScope;
    }
  ) {
    return this.productsService.update(
      data.id,
      data.updateProductDto,
      data.scope
    );
  }

  @MessagePattern(ProductCommands.REMOVE_PRODUCT)
  remove(@Payload() data: { id: string; scope: ProductScope }) {
    return this.productsService.remove(data.id, data.scope);
  }
}

export interface ProductScope {
  ownerId: string;
  workspaceId: string;
  appScope: string;
}

export interface ProductListQuery extends Partial<ProductScope> {
  catalogId?: string;
  public?: boolean;
}

export interface ProductReadQuery extends Partial<ProductScope> {
  id: string;
  catalogId?: string;
  public?: boolean;
}
