import { Inject, Injectable } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TimerEntity } from "../entities";
import { CreateTimerDto, UpdateTimerDto } from "@optimistic-tanuki/models";

@Injectable()
export class TimersService {
    constructor(
        @Inject(getRepositoryToken(TimerEntity)) private readonly timerRepo: Repository<TimerEntity>
    ) {}

    async create(createTimerDto: CreateTimerDto): Promise<TimerEntity> {
        const timer = await this.timerRepo.create(createTimerDto);
        return (await this.timerRepo.save(timer))[0];
    }

    async findOne(id: string): Promise<TimerEntity> {
        return await this.timerRepo.findOne({ where: { id }});
    }

    async update(id: string, updateTimerDto: UpdateTimerDto): Promise<TimerEntity> {
        await this.timerRepo.update(id, updateTimerDto);
        return await this.findOne(id);
    }

    async remove(id: string): Promise<void> {
        await await this.timerRepo.delete(id);
    }

}