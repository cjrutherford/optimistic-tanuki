import { Inject, Injectable } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Timeline } from "../timelines/entities/timeline.entity";
import { FindManyOptions, FindOneOptions, Repository } from "typeorm";
import { CreateTimelineDto } from "../timelines/dto/create-timeline.dto";
import { UpdateTimelineDto } from "../timelines/dto/update-timeline.dto";

@Injectable()
export class TimelineService {
  constructor(
    @Inject(getRepositoryToken(Timeline))
    private readonly timelineRepository: Repository<Timeline>,
  ) {}

    async findAll(query?: FindManyOptions<Timeline>): Promise<Timeline[]> {
        return await this.timelineRepository.find(query || {});
    }

    async findOne(id: string, query?: FindOneOptions<Timeline>): Promise<Timeline> {
        return await this.timelineRepository.findOne({ where: { id }, ...query});
    }

    async create(timeline: CreateTimelineDto): Promise<Timeline> {
        return await this.timelineRepository.save(timeline);
    }

    async update(id: string, timeline: UpdateTimelineDto): Promise<Timeline> {
        await this.timelineRepository.update(id, timeline);
        return await this.timelineRepository.findOne({where: { id }});
    }
}