import { Inject, Injectable } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Goal } from "../goals/entities/goal.entity";
import { FindManyOptions, FindOneOptions, FindOptions, Repository } from "typeorm";
import { CreateGoalDto } from "../goals/dto/create-goal.dto";
import { UpdateGoalDto } from "../goals/dto/update-goal.dto";

@Injectable()
export class GoalService {
    constructor(
        @Inject(getRepositoryToken(Goal)) private readonly goalRepository: Repository<Goal>
    ) {}
    
    async findAll(query?: FindManyOptions<Goal>): Promise<Goal[]> {
        return await this.goalRepository.find(query);
    }

    async findOne(id: string, query?: FindOneOptions): Promise<Goal> {
        return await this.goalRepository.findOne({ where: { id, ...query }});
    }

    async create(goal: CreateGoalDto): Promise<Goal> {
        return await this.goalRepository.save(goal);
    }

    async update(id: string, goal: UpdateGoalDto): Promise<Goal> {
        await this.goalRepository.update(id, goal);
        return await this.goalRepository.findOne({ where: { id }});
    }
}