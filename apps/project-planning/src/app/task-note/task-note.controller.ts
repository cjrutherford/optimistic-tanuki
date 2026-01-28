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
  async create(@Payload() createDto: CreateTaskNoteDto) {
    return await this.service.create(createDto);
  }

  @MessagePattern({ cmd: TaskNoteCommands.FIND_ALL })
  async findAll(@Payload() query: QueryTaskNoteDto) {
    return await this.service.findAll(query);
  }

  @MessagePattern({ cmd: TaskNoteCommands.FIND_ONE })
  async findOne(@Payload() id: string) {
    return await this.service.findOne(id);
  }

  @MessagePattern({ cmd: TaskNoteCommands.UPDATE })
  async update(@Payload() updateDto: UpdateTaskNoteDto) {
    return await this.service.update(updateDto.id, updateDto);
  }

  @MessagePattern({ cmd: TaskNoteCommands.REMOVE })
  async remove(@Payload() id: string) {
    return await this.service.remove(id);
  }
}
