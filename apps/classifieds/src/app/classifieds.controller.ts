import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ClassifiedCommands } from '@optimistic-tanuki/constants';
import {
  ClassifiedsService,
  CreateClassifiedAdDto,
  UpdateClassifiedAdDto,
  SearchClassifiedsDto,
} from './classifieds.service';

@Controller()
export class ClassifiedsController {
  private readonly logger = new Logger(ClassifiedsController.name);

  constructor(private readonly classifiedsService: ClassifiedsService) {}

  @MessagePattern({ cmd: ClassifiedCommands.CREATE })
  async create(
    @Payload()
    data: {
      dto: CreateClassifiedAdDto;
      profileId: string;
      userId: string;
      appScope?: string;
    }
  ) {
    this.logger.log(`Creating classified for profile ${data.profileId}`);
    return this.classifiedsService.create(
      data.dto,
      data.profileId,
      data.userId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: ClassifiedCommands.FIND_BY_ID })
  async findById(@Payload() data: { id: string }) {
    return this.classifiedsService.findById(data.id);
  }

  @MessagePattern({ cmd: ClassifiedCommands.FIND_BY_COMMUNITY })
  async findByCommunity(
    @Payload() data: { communityId: string; appScope?: string }
  ) {
    return this.classifiedsService.findByCommunity(
      data.communityId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: ClassifiedCommands.FIND_BY_PROFILE })
  async findByProfile(@Payload() data: { profileId: string }) {
    return this.classifiedsService.findByProfile(data.profileId);
  }

  @MessagePattern({ cmd: ClassifiedCommands.SEARCH })
  async search(@Payload() dto: SearchClassifiedsDto) {
    return this.classifiedsService.search(dto);
  }

  @MessagePattern({ cmd: ClassifiedCommands.UPDATE })
  async update(
    @Payload()
    data: { id: string; dto: UpdateClassifiedAdDto; profileId: string }
  ) {
    return this.classifiedsService.update(data.id, data.dto, data.profileId);
  }

  @MessagePattern({ cmd: ClassifiedCommands.DELETE })
  async remove(@Payload() data: { id: string; profileId: string }) {
    return this.classifiedsService.remove(data.id, data.profileId);
  }

  @MessagePattern({ cmd: ClassifiedCommands.MARK_SOLD })
  async markSold(@Payload() data: { id: string; profileId: string }) {
    return this.classifiedsService.markSold(data.id, data.profileId);
  }

  @MessagePattern({ cmd: ClassifiedCommands.FEATURE })
  async feature(
    @Payload() data: { id: string; profileId: string; durationDays: number }
  ) {
    return this.classifiedsService.feature(
      data.id,
      data.profileId,
      data.durationDays
    );
  }

  @MessagePattern({ cmd: ClassifiedCommands.UNFEATURE })
  async unfeature(@Payload() data: { id: string }) {
    return this.classifiedsService.unfeature(data.id);
  }
}
