import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ComponentsService } from '../../services/components.service';
import { HardwareCommands } from '@optimistic-tanuki/constants';

@Controller()
export class ComponentsController {
  constructor(private readonly componentsService: ComponentsService) {}

  @MessagePattern({ cmd: HardwareCommands.FIND_ALL_COMPONENTS })
  async findAll(@Payload() data: { type: string; chassisId?: string }) {
    return this.componentsService.findAll(data.type, data.chassisId);
  }

  @MessagePattern({ cmd: HardwareCommands.FIND_COMPONENT_BY_ID })
  async findById(@Payload() data: { id: string }) {
    return this.componentsService.findById(data.id);
  }
}
