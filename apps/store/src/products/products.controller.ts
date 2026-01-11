import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from '@optimistic-tanuki/models';

@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @MessagePattern({ cmd: 'createProduct' })
  create(@Payload() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @MessagePattern({ cmd: 'findAllProducts' })
  findAll() {
    return this.productsService.findAll();
  }

  @MessagePattern({ cmd: 'findOneProduct' })
  findOne(@Payload() id: string) {
    return this.productsService.findOne(id);
  }

  @MessagePattern({ cmd: 'updateProduct' })
  update(@Payload() data: { id: string; updateProductDto: UpdateProductDto }) {
    return this.productsService.update(data.id, data.updateProductDto);
  }

  @MessagePattern({ cmd: 'removeProduct' })
  remove(@Payload() id: string) {
    return this.productsService.remove(id);
  }
}
