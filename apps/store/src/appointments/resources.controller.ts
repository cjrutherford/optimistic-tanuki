import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateResourceDto,
  UpdateResourceDto,
} from '@optimistic-tanuki/models';
import { ResourcesService } from './resources.service';

@Controller()
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @MessagePattern({ cmd: 'createResource' })
  create(@Payload() createResourceDto: CreateResourceDto) {
    return this.resourcesService.create(createResourceDto);
  }

  @MessagePattern({ cmd: 'findAllResources' })
  findAll() {
    return this.resourcesService.findAll();
  }

  @MessagePattern({ cmd: 'findResourcesByType' })
  findByType(@Payload() type: string) {
    return this.resourcesService.findByType(type);
  }

  @MessagePattern({ cmd: 'findOneResource' })
  findOne(@Payload() id: string) {
    return this.resourcesService.findOne(id);
  }

  @MessagePattern({ cmd: 'updateResource' })
  update(
    @Payload() data: { id: string; updateResourceDto: UpdateResourceDto }
  ) {
    return this.resourcesService.update(data.id, data.updateResourceDto);
  }

  @MessagePattern({ cmd: 'removeResource' })
  remove(@Payload() id: string) {
    return this.resourcesService.remove(id);
  }

  @MessagePattern({ cmd: 'checkResourceAvailability' })
  checkAvailability(
    @Payload() data: { resourceId: string; startTime: Date; endTime: Date }
  ) {
    return this.resourcesService.checkAvailability(
      data.resourceId,
      data.startTime,
      data.endTime
    );
  }
}
