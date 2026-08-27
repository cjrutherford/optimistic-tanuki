import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TaskTimeEntryService } from './task-time-entry.service';
import {
  CreateTaskTimeEntryDto,
  UpdateTaskTimeEntryDto,
  QueryTaskTimeEntryDto,
} from '@optimistic-tanuki/models';
import { TaskTimeEntryCommands } from '@optimistic-tanuki/constants';

@Controller()
export class TaskTimeEntryController {
  constructor(private readonly service: TaskTimeEntryService) {}

  @MessagePattern({ cmd: TaskTimeEntryCommands.CREATE })
  async create(
    @Payload()
    createDto: CreateTaskTimeEntryDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...dto } = createDto;
    return await this.service.create(dto, requestingUserId);
  }

  @MessagePattern({ cmd: TaskTimeEntryCommands.FIND_ALL })
  async findAll(
    @Payload() query: QueryTaskTimeEntryDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...q } = query;
    return await this.service.findAll(q, requestingUserId);
  }

  @MessagePattern({ cmd: TaskTimeEntryCommands.FIND_ONE })
  async findOne(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.service.findOne(id, requestingUserId);
  }

  @MessagePattern({ cmd: TaskTimeEntryCommands.UPDATE })
  async update(
    @Payload()
    updateDto: UpdateTaskTimeEntryDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...dto } = updateDto;
    return await this.service.update(dto.id, dto, requestingUserId);
  }

  @MessagePattern({ cmd: TaskTimeEntryCommands.STOP })
  async stop(
    @Payload()
    payload: {
      id: string;
      updatedBy: string;
      requestingUserId?: string;
    }
  ) {
    return await this.service.stop(
      payload.id,
      payload.updatedBy,
      payload.requestingUserId
    );
  }

  @MessagePattern({ cmd: TaskTimeEntryCommands.REMOVE })
  async remove(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.service.remove(id, requestingUserId);
  }
}
