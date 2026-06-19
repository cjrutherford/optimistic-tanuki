import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrderCommands } from '@optimistic-tanuki/constants';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto } from '@optimistic-tanuki/models';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @MessagePattern(OrderCommands.CREATE_ORDER)
  create(@Payload() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @MessagePattern(OrderCommands.FIND_ALL_ORDERS)
  findAll() {
    return this.ordersService.findAll();
  }

  @MessagePattern(OrderCommands.FIND_USER_ORDERS)
  findUserOrders(@Payload() userId: string) {
    return this.ordersService.findByUser(userId);
  }

  @MessagePattern(OrderCommands.FIND_ONE_ORDER)
  findOne(@Payload() id: string) {
    return this.ordersService.findOne(id);
  }

  @MessagePattern(OrderCommands.UPDATE_ORDER)
  update(@Payload() data: { id: string; updateOrderDto: UpdateOrderDto }) {
    return this.ordersService.update(data.id, data.updateOrderDto);
  }
}
