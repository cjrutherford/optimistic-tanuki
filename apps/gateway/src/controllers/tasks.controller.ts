import { Controller, Post, Get, Put, Delete, Body, Param, Query, Inject } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { CreateTaskDto, SearchTaskDto, UpdateTaskDto } from "@optimistic-tanuki/models";
import { ServiceTokens, TasksCommands } from "@optimistic-tanuki/constants";
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from "@nestjs/swagger";

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {

    constructor(@Inject(ServiceTokens.TASKS_SERVICE) private readonly client: ClientProxy) {}

    @Post()
    @ApiOperation({ summary: 'Create a new task' })
    @ApiBody({ type: CreateTaskDto })
    @ApiResponse({ status: 201, description: 'The task has been successfully created.' })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    async create(@Body() createTaskDto: CreateTaskDto) {
        return this.client.send({ cmd: TasksCommands.CREATE }, createTaskDto);
    }

    @Get()
    @ApiOperation({ summary: 'Retrieve all tasks' })
    @ApiQuery({ name: 'search', required: false, type: SearchTaskDto })
    @ApiResponse({ status: 200, description: 'List of tasks.' })
    async findAll(@Query() search?: SearchTaskDto) {
        return this.client.send({ cmd: TasksCommands.FIND_ALL }, search);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Retrieve a task by ID' })
    @ApiParam({ name: 'id', required: true, description: 'Task ID' })
    @ApiResponse({ status: 200, description: 'The task details.' })
    @ApiResponse({ status: 404, description: 'Task not found.' })
    async findOne(@Param('id') id: string) {
        return this.client.send({ cmd: TasksCommands.FIND_ONE }, id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a task by ID' })
    @ApiParam({ name: 'id', required: true, description: 'Task ID' })
    @ApiBody({ type: UpdateTaskDto })
    @ApiResponse({ status: 200, description: 'The task has been successfully updated.' })
    @ApiResponse({ status: 404, description: 'Task not found.' })
    async update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
        return this.client.send({ cmd: TasksCommands.UPDATE }, { id, data: updateTaskDto });
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a task by ID' })
    @ApiParam({ name: 'id', required: true, description: 'Task ID' })
    @ApiResponse({ status: 200, description: 'The task has been successfully deleted.' })
    @ApiResponse({ status: 404, description: 'Task not found.' })
    async remove(@Param('id') id: string) {
        return this.client.send({ cmd: TasksCommands.DELETE }, id);
    }
}