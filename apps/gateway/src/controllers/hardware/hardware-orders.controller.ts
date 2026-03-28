import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Inject,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ServiceTokens, HardwareCommands } from '@optimistic-tanuki/constants';
import { ConfigurationDto, ShippingAddress } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { Public } from '../../decorators/public.decorator';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { AuthGuard } from '../../auth/auth.guard';

interface CreateOrderBody {
  configuration: ConfigurationDto;
  shippingAddress: ShippingAddress;
  customerEmail: string;
}

@ApiTags('hardware-orders')
@Controller('hardware/orders')
export class HardwareOrdersController {
  constructor(
    @Inject(ServiceTokens.HARDWARE_SERVICE)
    private readonly hardwareClient: ClientProxy
  ) {}

  @Post()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('hardware.order.create')
  @ApiOperation({ summary: 'Create a new hardware order' })
  async create(@Body() body: CreateOrderBody) {
    return firstValueFrom(
      this.hardwareClient.send({ cmd: HardwareCommands.CREATE_ORDER }, body)
    );
  }

  @Get()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('hardware.order.read')
  @ApiOperation({ summary: 'Get all orders' })
  async findAll() {
    return firstValueFrom(
      this.hardwareClient.send({ cmd: HardwareCommands.FIND_ALL_ORDERS }, {})
    );
  }

  @Get(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('hardware.order.read')
  @ApiOperation({ summary: 'Get order by ID' })
  async findById(@Param('id') id: string) {
    return firstValueFrom(
      this.hardwareClient.send(
        { cmd: HardwareCommands.FIND_ORDER_BY_ID },
        { id }
      )
    );
  }
}
