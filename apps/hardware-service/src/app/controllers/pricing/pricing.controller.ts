import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PricingService } from '../../services/pricing.service';
import { HardwareCommands } from '@optimistic-tanuki/constants';
import { ConfigurationDto } from '@optimistic-tanuki/models';

@Controller()
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @MessagePattern({ cmd: HardwareCommands.CALCULATE_PRICE })
  async calculatePrice(@Payload() dto: ConfigurationDto) {
    return this.pricingService.calculatePrice(dto);
  }
}
