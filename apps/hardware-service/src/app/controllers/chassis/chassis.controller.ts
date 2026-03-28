import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChassisService } from '../../services/chassis.service';
import { HardwareCommands } from '@optimistic-tanuki/constants';
import { ChassisType, ChassisUseCase } from '@optimistic-tanuki/models';

@Controller()
export class ChassisController {
  constructor(private readonly chassisService: ChassisService) {}

  @MessagePattern({ cmd: HardwareCommands.FIND_ALL_CHASSIS })
  async findAll(
    @Payload() filters?: { type?: ChassisType; useCase?: ChassisUseCase }
  ) {
    return this.chassisService.findAll(filters);
  }

  @MessagePattern({ cmd: HardwareCommands.FIND_CHASSIS_BY_ID })
  async findById(@Payload() data: { id: string }) {
    return this.chassisService.findById(data.id);
  }

  @MessagePattern({ cmd: HardwareCommands.GET_COMPATIBLE_COMPONENTS })
  async getCompatible(@Payload() data: { chassisId: string }) {
    return this.chassisService.getCompatibleComponents(data.chassisId);
  }
}
