import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductCommands } from '@optimistic-tanuki/constants';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from '@optimistic-tanuki/models';

@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @MessagePattern(ProductCommands.CREATE_PRODUCT)
  create(@Payload() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @MessagePattern(ProductCommands.FIND_ALL_PRODUCTS)
  findAll() {
    return this.productsService.findAll();
  }

  @MessagePattern(ProductCommands.FIND_OWNER_PRODUCTS)
  findOwnerProducts(@Payload() ownerId: string) {
    return this.productsService.findOwnerProducts(ownerId);
  }

  @MessagePattern(ProductCommands.FIND_ONE_PRODUCT)
  findOne(@Payload() id: string) {
    return this.productsService.findOne(id);
  }

  @MessagePattern(ProductCommands.UPDATE_PRODUCT)
  update(@Payload() data: { id: string; updateProductDto: UpdateProductDto }) {
    return this.productsService.update(data.id, data.updateProductDto);
  }

  @MessagePattern(ProductCommands.REMOVE_PRODUCT)
  remove(@Payload() id: string) {
    return this.productsService.remove(id);
  }
}
