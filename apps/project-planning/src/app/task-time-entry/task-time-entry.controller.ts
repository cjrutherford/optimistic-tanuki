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
  async create(@Payload() createDto: CreateTaskTimeEntryDto) {
    return await this.service.create(createDto);
  }

  @MessagePattern({ cmd: TaskTimeEntryCommands.FIND_ALL })
  async findAll(@Payload() query: QueryTaskTimeEntryDto) {
    return await this.service.findAll(query);
  }

  @MessagePattern({ cmd: TaskTimeEntryCommands.FIND_ONE })
  async findOne(@Payload() id: string) {
    return await this.service.findOne(id);
  }

  @MessagePattern({ cmd: TaskTimeEntryCommands.UPDATE })
  async update(@Payload() updateDto: UpdateTaskTimeEntryDto) {
    return await this.service.update(updateDto.id, updateDto);
  }

  @MessagePattern({ cmd: TaskTimeEntryCommands.STOP })
  async stop(@Payload() payload: { id: string; updatedBy: string }) {
    return await this.service.stop(payload.id, payload.updatedBy);
  }

  @MessagePattern({ cmd: TaskTimeEntryCommands.REMOVE })
  async remove(@Payload() id: string) {
    return await this.service.remove(id);
  }
}
