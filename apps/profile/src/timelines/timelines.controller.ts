import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TimelineCommands } from '@optimistic-tanuki/constants';
import { CreateTimelineDto } from './dto/create-timeline.dto';
import { TimelineService } from '../app/timeline.service';
import { Timeline } from './entities/timeline.entity';
import { FindManyOptions, FindOneOptions } from 'typeorm';

@Controller('timelines')
export class TimelinesController {
    constructor(private readonly timeLineService: TimelineService) {}

    @MessagePattern({ cmd: TimelineCommands.Create })
    async create(@Payload() createTimeline: CreateTimelineDto) {
        return await this.timeLineService.create(createTimeline);
    }

    @MessagePattern({ cmd: TimelineCommands.GetAll })
    async findAll(@Payload() query?: FindManyOptions<Timeline>) {
        return await this.timeLineService.findAll(query);
    }

    @MessagePattern({ cmd: TimelineCommands.Get })
    async findOne(@Payload('id') id: string, @Payload('query') query?: FindOneOptions<Timeline>) {
        return await this.timeLineService.findOne(id, query);
    }
}
