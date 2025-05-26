
import { Controller, Post, Get, Put, Delete, Body, Param } from "@nestjs/common";
import { TimersService } from "../services/timers.service";
import { CreateTimerDto, UpdateTimerDto } from "@optimistic-tanuki/models";
import { TimerEntity } from "../entities";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { TimersCommands } from "@optimistic-tanuki/constants";

@Controller('timers')
export class TimersController {
    constructor(private readonly timersService: TimersService) {}

    @MessagePattern({ cmd: TimersCommands.CREATE})
    async create(@Payload() createTimerDto: CreateTimerDto): Promise<TimerEntity> {
        return this.timersService.create(createTimerDto);
    }

    @MessagePattern({ cmd: TimersCommands.FIND_ONE })
    async findOne(@Param('id') id: string): Promise<TimerEntity> {
        return this.timersService.findOne(id);
    }

    @MessagePattern({ cmd: TimersCommands.UPDATE })
    async update(@Payload('id') id: string, @Payload('data') updateTimerDto: UpdateTimerDto): Promise<TimerEntity> {
        return this.timersService.update(id, updateTimerDto);
    }

    @Delete(':id')
    async remove(@Payload('id') id: string): Promise<void> {
        return this.timersService.remove(id);
    }
}