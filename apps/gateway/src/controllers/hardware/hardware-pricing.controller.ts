import { Controller, Post, Body, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ServiceTokens, HardwareCommands } from '@optimistic-tanuki/constants';
import { ConfigurationDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { Public } from '../../decorators/public.decorator';

@ApiTags('hardware-pricing')
@Controller('hardware/pricing')
export class HardwarePricingController {
  constructor(
    @Inject(ServiceTokens.HARDWARE_SERVICE)
    private readonly hardwareClient: ClientProxy
  ) {}

  @Post('calculate')
  @Public()
  @ApiOperation({ summary: 'Calculate price (customer-facing)' })
  async calculatePrice(@Body() dto: ConfigurationDto) {
    return firstValueFrom(
      this.hardwareClient.send({ cmd: HardwareCommands.CALCULATE_PRICE }, dto)
    );
  }
}
