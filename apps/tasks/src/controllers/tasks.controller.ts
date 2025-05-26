
import { Controller, Post, Get, Put, Delete, Body, Param, Query } from "@nestjs/common";
import { TasksService } from "../services/tasks.service";
import { CreateTaskDto, SearchTaskDto, UpdateTaskDto } from "@optimistic-tanuki/models";
import { TaskEntity } from "../entities";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { TasksCommands } from "@optimistic-tanuki/constants";

@Controller('tasks')
export class TasksController {
    constructor(private readonly tasksService: TasksService) {}

    @MessagePattern({ cmd: TasksCommands.CREATE })
    async create(@Payload() createTaskDto: CreateTaskDto): Promise<TaskEntity> {
        return this.tasksService.create(createTaskDto);
    }

    @MessagePattern({ cmd: TasksCommands.FIND_ALL })
    async findAll(@Payload() search?: SearchTaskDto): Promise<TaskEntity[]> {
        return this.tasksService.findAll(search);
    }

    @MessagePattern({ cmd: TasksCommands.FIND_ONE })
    async findOne(@Payload('id') id: string): Promise<TaskEntity> {
        return this.tasksService.findOne(id);
    }

    @MessagePattern({ cmd: TasksCommands.UPDATE })
    async update(@Payload('id') id: string, @Payload('data') updateTaskDto: UpdateTaskDto): Promise<TaskEntity> {
        return this.tasksService.update(id, updateTaskDto);
    }

    @MessagePattern({ cmd: TasksCommands.DELETE })
    async remove(@Payload('id') id: string): Promise<void> {
        return this.tasksService.remove(id);
    }
}