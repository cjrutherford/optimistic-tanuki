import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TaskService } from './task.service';
import { CreateTaskDto, QueryTaskDto, UpdateTaskDto } from '@optimistic-tanuki/models'; 
import { TaskCommands } from '@optimistic-tanuki/constants';

@Controller()
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @MessagePattern({ cmd: TaskCommands.CREATE })
  async create(@Payload() createTaskDto: CreateTaskDto) {
    return await this.taskService.create(createTaskDto);
  }

  @MessagePattern({ cmd: TaskCommands.FIND_ALL })
  async findAll(@Payload() query: QueryTaskDto) {
    return await this.taskService.findAll(query);
  }

  @MessagePattern({ cmd: TaskCommands.FIND_ONE })
  async findOne(@Payload() id: string) {
    return await this.taskService.findOne(id);
  }

  @MessagePattern({ cmd: TaskCommands.UPDATE })
  async update(@Payload() updateTaskDto: UpdateTaskDto) {
    return await this.taskService.update(updateTaskDto.id, updateTaskDto);
  }

  @MessagePattern({ cmd: TaskCommands.DELETE })
  async remove(@Payload() id: string) {
    return await this.taskService.remove(id);
  }
}
