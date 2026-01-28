import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TaskTagService } from './task-tag.service';
import {
  CreateTaskTagDto,
  UpdateTaskTagDto,
  QueryTaskTagDto,
} from '@optimistic-tanuki/models';
import { TaskTagCommands } from '@optimistic-tanuki/constants';

@Controller()
export class TaskTagController {
  constructor(private readonly service: TaskTagService) {}

  @MessagePattern({ cmd: TaskTagCommands.CREATE })
  async create(@Payload() createDto: CreateTaskTagDto) {
    return await this.service.create(createDto);
  }

  @MessagePattern({ cmd: TaskTagCommands.FIND_ALL })
  async findAll(@Payload() query: QueryTaskTagDto) {
    return await this.service.findAll(query);
  }

  @MessagePattern({ cmd: TaskTagCommands.FIND_ONE })
  async findOne(@Payload() id: string) {
    return await this.service.findOne(id);
  }

  @MessagePattern({ cmd: TaskTagCommands.UPDATE })
  async update(@Payload() updateDto: UpdateTaskTagDto) {
    return await this.service.update(updateDto.id, updateDto);
  }

  @MessagePattern({ cmd: TaskTagCommands.REMOVE })
  async remove(@Payload() id: string) {
    return await this.service.remove(id);
  }
}
