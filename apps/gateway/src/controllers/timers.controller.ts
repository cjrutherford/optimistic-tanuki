import { Controller, Post, Get, Put, Delete, Body, Param, Inject } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { CreateTimerDto, UpdateTimerDto } from "@optimistic-tanuki/models";
import { ServiceTokens, TimersCommands } from "@optimistic-tanuki/constants";
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from "@nestjs/swagger";

@ApiTags('timer')
@Controller('timers')
export class TimersController {

    constructor(@Inject(ServiceTokens.TASKS_SERVICE) private readonly client: ClientProxy) {}

    @Post()
    @ApiOperation({ summary: 'Create a new timer' })
    @ApiBody({ type: CreateTimerDto })
    @ApiResponse({ status: 201, description: 'The timer has been successfully created.' })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    async create(@Body() createTimerDto: CreateTimerDto) {
        return this.client.send({ cmd: TimersCommands.CREATE }, createTimerDto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a timer by ID' })
    @ApiParam({ name: 'id', description: 'The ID of the timer to retrieve' })
    @ApiResponse({ status: 200, description: 'The timer has been successfully retrieved.' })
    @ApiResponse({ status: 404, description: 'Timer not found.' })
    async findOne(@Param('id') id: string) {
        return this.client.send({ cmd: TimersCommands.FIND_ONE }, id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a timer by ID' })
    @ApiParam({ name: 'id', description: 'The ID of the timer to update' })
    @ApiBody({ type: UpdateTimerDto })
    @ApiResponse({ status: 200, description: 'The timer has been successfully updated.' })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 404, description: 'Timer not found.' })
    async update(@Param('id') id: string, @Body() updateTimerDto: UpdateTimerDto) {
        return this.client.send({ cmd: TimersCommands.UPDATE }, { id, data: updateTimerDto });
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a timer by ID' })
    @ApiParam({ name: 'id', description: 'The ID of the timer to delete' })
    @ApiResponse({ status: 200, description: 'The timer has been successfully deleted.' })
    @ApiResponse({ status: 404, description: 'Timer not found.' })
    async remove(@Param('id') id: string) {
        return this.client.send({ cmd: TimersCommands.DELETE }, id);
    }
}