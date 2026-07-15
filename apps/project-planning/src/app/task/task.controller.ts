import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TaskService } from './task.service';
import {
  CreateTaskDto,
  QueryTaskDto,
  UpdateTaskDto,
} from '@optimistic-tanuki/models';
import { TaskCommands } from '@optimistic-tanuki/constants';

@Controller()
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @MessagePattern({ cmd: TaskCommands.CREATE })
  async create(
    @Payload() createTaskDto: CreateTaskDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...dto } = createTaskDto;
    return await this.taskService.create(dto, requestingUserId);
  }

  @MessagePattern({ cmd: TaskCommands.FIND_ALL })
  async findAll(
    @Payload() query: QueryTaskDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...q } = query;
    return await this.taskService.findAll(q, requestingUserId);
  }

  @MessagePattern({ cmd: TaskCommands.FIND_ONE })
  async findOne(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.taskService.findOne(id, requestingUserId);
  }

  @MessagePattern({ cmd: TaskCommands.UPDATE })
  async update(
    @Payload() updateTaskDto: UpdateTaskDto & { requestingUserId?: string }
  ) {
    console.log('Updating task with DTO:', updateTaskDto);
    const { requestingUserId, ...dto } = updateTaskDto;
    return await this.taskService.update(dto.id, dto, requestingUserId);
  }

  @MessagePattern({ cmd: TaskCommands.DELETE })
  async remove(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.taskService.remove(id, requestingUserId);
  }
}
