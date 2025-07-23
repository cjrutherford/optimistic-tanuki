import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TaskService } from './task.service';
import { CreateTaskDto, UpdateTaskDto } from '@optimistic-tanuki/models'; 
import { TaskCommands } from '@optimistic-tanuki/constants';

@Controller()
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @MessagePattern(TaskCommands.CREATE)
  create(@Payload() createTaskDto: CreateTaskDto) {
    return this.taskService.create(createTaskDto);
  }

  @MessagePattern(TaskCommands.FIND_ALL)
  findAll() {
    return this.taskService.findAll();
  }

  @MessagePattern(TaskCommands.FIND_ONE)
  findOne(@Payload() id: number) {
    return this.taskService.findOne(id);
  }

  @MessagePattern(TaskCommands.UPDATE)
  update(@Payload() updateTaskDto: UpdateTaskDto) {
    return this.taskService.update(updateTaskDto.id, updateTaskDto);
  }

  @MessagePattern(TaskCommands.REMOVE)
  remove(@Payload() id: number) {
    return this.taskService.remove(id);
  }
}
