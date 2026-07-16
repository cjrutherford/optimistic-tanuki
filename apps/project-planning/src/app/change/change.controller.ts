import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChangeService } from './change.service';
import {
  CreateChangeDto,
  QueryChangeDto,
  UpdateChangeDto,
} from '@optimistic-tanuki/models';
import { ChangeCommands } from '@optimistic-tanuki/constants';

@Controller()
export class ChangeController {
  constructor(private readonly changeService: ChangeService) {}

  @MessagePattern({ cmd: ChangeCommands.CREATE })
  async create(
    @Payload() createChangeDto: CreateChangeDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...dto } = createChangeDto;
    return await this.changeService.create(dto, requestingUserId);
  }

  @MessagePattern({ cmd: ChangeCommands.FIND_ALL })
  async findAll(
    @Payload() query: QueryChangeDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...q } = query;
    return await this.changeService.findAll(q, requestingUserId);
  }

  @MessagePattern({ cmd: ChangeCommands.FIND_ONE })
  async findOne(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.changeService.findOne(id, requestingUserId);
  }

  @MessagePattern({ cmd: ChangeCommands.UPDATE })
  async update(
    @Payload() updateChangeDto: UpdateChangeDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...dto } = updateChangeDto;
    return await this.changeService.update(dto.id, dto, requestingUserId);
  }

  @MessagePattern({ cmd: ChangeCommands.REMOVE })
  async remove(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.changeService.remove(id, requestingUserId);
  }
}
