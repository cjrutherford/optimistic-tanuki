import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { HardwareCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  ConfigurationDto,
  CreateHardwareOrderDto,
} from '@optimistic-tanuki/models';

@Controller('hardware')
export class HardwareController {
  constructor(
    @Inject(ServiceTokens.SYSTEM_CONFIGURATOR_SERVICE)
    private readonly systemConfiguratorService: ClientProxy
  ) {}

  @Get('chassis')
  async getChassis() {
    return await firstValueFrom(
      this.systemConfiguratorService.send({ cmd: HardwareCommands.GET_CHASSIS }, {})
    );
  }

  @Get('chassis/:id')
  async getChassisById(@Param('id') id: string) {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.GET_CHASSIS_BY_ID },
        { id }
      )
    );
  }

  @Get('chassis/:id/compatible')
  async getCompatibleComponents(@Param('id') id: string) {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.GET_COMPATIBLE_COMPONENTS },
        { chassisId: id }
      )
    );
  }

  @Post('pricing/calculate')
  async calculatePrice(@Body() configuration: ConfigurationDto) {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.CALCULATE_PRICE },
        configuration
      )
    );
  }

  @Post('orders')
  async createOrder(@Body() payload: CreateHardwareOrderDto) {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.CREATE_ORDER },
        payload
      )
    );
  }

  @Get('orders/:id')
  async getOrder(@Param('id') id: string) {
    return await firstValueFrom(
      this.systemConfiguratorService.send(
        { cmd: HardwareCommands.GET_ORDER },
        { orderId: id }
      )
    );
  }
}
