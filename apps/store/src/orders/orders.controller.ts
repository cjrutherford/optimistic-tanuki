import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto } from '@optimistic-tanuki/models';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @MessagePattern({ cmd: 'createOrder' })
  create(@Payload() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @MessagePattern({ cmd: 'findAllOrders' })
  findAll() {
    return this.ordersService.findAll();
  }

  @MessagePattern({ cmd: 'findUserOrders' })
  findUserOrders(@Payload() userId: string) {
    return this.ordersService.findByUser(userId);
  }

  @MessagePattern({ cmd: 'findOneOrder' })
  findOne(@Payload() id: string) {
    return this.ordersService.findOne(id);
  }

  @MessagePattern({ cmd: 'updateOrder' })
  update(@Payload() data: { id: string; updateOrderDto: UpdateOrderDto }) {
    return this.ordersService.update(data.id, data.updateOrderDto);
  }
}
