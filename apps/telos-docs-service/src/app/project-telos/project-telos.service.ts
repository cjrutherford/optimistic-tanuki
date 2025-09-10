import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Any, FindOptionsWhere, Like, Repository } from 'typeorm';
import { ProjectTelos } from '../entities';
import { CreateProjectTelosDto, ProjectTelosDto, QueryProjectTelosDto, UpdateProjectTelosDto } from '@optimistic-tanuki/models';

@Injectable()
export class ProjectTelosService {
    constructor(
        @Inject(getRepositoryToken(ProjectTelos))
        private readonly projectRepository: Repository<ProjectTelos>,
    ) {}

    async create(data: CreateProjectTelosDto) {
        const project = this.projectRepository.create(data);
        return await this.projectRepository.save(project);
    }

    async findAll(query: QueryProjectTelosDto): Promise<ProjectTelosDto[]> {
        const where: FindOptionsWhere<ProjectTelos> = {};

        if(query.name) {
            where.name = query.name;
        }

        if(query.description) {
            where.description = query.description;
        }

        if(query.goals) {
            where.goals = Any(query.goals);
        }

        if(query.skills) {
            where.skills = Any(query.skills);
        }

        if(query.interests) {
            where.interests = Any(query.interests);
        }

        if(query.limitations) {
            where.limitations = Any(query.limitations);
        }

        if(query.strengths) {
            where.strengths = Any(query.strengths);
        }

        if(query.objectives) {
            where.objectives = Any(query.objectives);
        }

        if(query.coreObjective) {
            where.coreObjective = Like(`%${query.coreObjective}%`);
        }   

        return await this.projectRepository.find({ where });
    }

    async findOne(id: string): Promise<ProjectTelosDto | null> {
        return await this.projectRepository.findOne({ where: { id } });
    }

    async update(id: string, data: UpdateProjectTelosDto): Promise<ProjectTelos | null> {
        await this.projectRepository.update(id, data);
        return await this.findOne(id);
    }

    async remove(id: string): Promise<void> {
        await this.projectRepository.delete(id);
    }
}
