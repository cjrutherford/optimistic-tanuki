import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TaskNoteService } from './task-note.service';
import {
  CreateTaskNoteDto,
  UpdateTaskNoteDto,
  QueryTaskNoteDto,
} from '@optimistic-tanuki/models';
import { TaskNoteCommands } from '@optimistic-tanuki/constants';

@Controller()
export class TaskNoteController {
  constructor(private readonly service: TaskNoteService) {}

  @MessagePattern({ cmd: TaskNoteCommands.CREATE })
  async create(
    @Payload() createDto: CreateTaskNoteDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...dto } = createDto;
    return await this.service.create(dto, requestingUserId);
  }

  @MessagePattern({ cmd: TaskNoteCommands.FIND_ALL })
  async findAll(
    @Payload() query: QueryTaskNoteDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...q } = query;
    return await this.service.findAll(q, requestingUserId);
  }

  @MessagePattern({ cmd: TaskNoteCommands.FIND_ONE })
  async findOne(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.service.findOne(id, requestingUserId);
  }

  @MessagePattern({ cmd: TaskNoteCommands.UPDATE })
  async update(
    @Payload() updateDto: UpdateTaskNoteDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...dto } = updateDto;
    return await this.service.update(dto.id, dto, requestingUserId);
  }

  @MessagePattern({ cmd: TaskNoteCommands.REMOVE })
  async remove(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.service.remove(id, requestingUserId);
  }
}
