import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrdersService } from '../../services/orders.service';
import { HardwareCommands } from '@optimistic-tanuki/constants';
import { ConfigurationDto, ShippingAddress } from '@optimistic-tanuki/models';

interface CreateOrderPayload {
  configuration: ConfigurationDto;
  shippingAddress: ShippingAddress;
  customerEmail: string;
  ownerId?: string;
}

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @MessagePattern({ cmd: HardwareCommands.CREATE_ORDER })
  async create(@Payload() data: CreateOrderPayload) {
    return this.ordersService.create(
      data.configuration,
      data.shippingAddress,
      data.customerEmail,
      data.ownerId
    );
  }

  @MessagePattern({ cmd: HardwareCommands.FIND_ALL_ORDERS })
  async findAll() {
    return this.ordersService.findAll();
  }

  @MessagePattern({ cmd: HardwareCommands.FIND_ORDER_BY_ID })
  async findById(@Payload() data: { id: string }) {
    return this.ordersService.findById(data.id);
  }

  @MessagePattern({ cmd: HardwareCommands.UPDATE_ORDER_STATUS })
  async updateStatus(@Payload() data: { id: string; status: string }) {
    return this.ordersService.updateStatus(data.id, data.status);
  }
}
