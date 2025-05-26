import { Inject, Injectable } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { convertSearchTaskDtoToFindOptions, TaskEntity } from "../entities";
import { Repository } from "typeorm";
import { CreateTaskDto, SearchTaskDto, UpdateTaskDto } from "@optimistic-tanuki/models";

@Injectable()
export class TasksService {
    //meaningless change
    constructor(
        @Inject(getRepositoryToken(TaskEntity)) private readonly taskRepo: Repository<TaskEntity>
    ) {}

    async create(createTaskDto: CreateTaskDto): Promise<TaskEntity> {
        const task = await this.taskRepo.create(createTaskDto);
        return (await this.taskRepo.save(task))[0];
    }

    async findAll(search?: SearchTaskDto): Promise<TaskEntity[]> {
        const query = convertSearchTaskDtoToFindOptions(search);
        return this.taskRepo.find(query);
    }

    async findOne(id: string): Promise<TaskEntity> {
        return await this.taskRepo.findOne({ where: { id }});
    }

    async update(id: string, updateTaskDto: UpdateTaskDto): Promise<TaskEntity> {
        await this.taskRepo.update(id, updateTaskDto);
        return await this.findOne(id);
    }

    async remove(id: string): Promise<void> {
        await this.taskRepo.delete(id);
    }
}