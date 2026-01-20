import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateAvailabilityDto,
  UpdateAvailabilityDto,
} from '@optimistic-tanuki/models';
import { AvailabilitiesService } from './availabilities.service';

@Controller()
export class AvailabilitiesController {
  constructor(
    private readonly availabilitiesService: AvailabilitiesService
  ) {}

  @MessagePattern({ cmd: 'createAvailability' })
  create(@Payload() createAvailabilityDto: CreateAvailabilityDto) {
    return this.availabilitiesService.create(createAvailabilityDto);
  }

  @MessagePattern({ cmd: 'findAllAvailabilities' })
  findAll() {
    return this.availabilitiesService.findAll();
  }

  @MessagePattern({ cmd: 'findOwnerAvailabilities' })
  findOwnerAvailabilities(@Payload() ownerId: string) {
    return this.availabilitiesService.findOwnerAvailabilities(ownerId);
  }

  @MessagePattern({ cmd: 'findOneAvailability' })
  findOne(@Payload() id: string) {
    return this.availabilitiesService.findOne(id);
  }

  @MessagePattern({ cmd: 'updateAvailability' })
  update(
    @Payload()
    data: { id: string; updateAvailabilityDto: UpdateAvailabilityDto }
  ) {
    return this.availabilitiesService.update(
      data.id,
      data.updateAvailabilityDto
    );
  }

  @MessagePattern({ cmd: 'removeAvailability' })
  remove(@Payload() id: string) {
    return this.availabilitiesService.remove(id);
  }
}
