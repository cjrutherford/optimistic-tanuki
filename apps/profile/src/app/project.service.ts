import { Inject, Injectable } from "@nestjs/common";
import { Project } from "../projects/entities/project.entity";
import { getRepositoryToken } from "@nestjs/typeorm";
import { FindManyOptions, FindOneOptions, Repository } from "typeorm";
import { CreateProjectDto } from "../projects/dto/create-project.dto";
import { UpdateProjectDto } from "../projects/dto/update-project.dto";

@Injectable()
export class ProjectService {
    constructor(
        @Inject(getRepositoryToken(Project))
        private readonly projectRepository: Repository<Project>,
    ) {}

    async findAll(query?:FindManyOptions<Project>): Promise<Project[]> {
        return await this.projectRepository.find(query || {});
    }

    async findOne(id: string, query?: FindOneOptions<Project>): Promise<Project> {
        return await this.projectRepository.findOne({ where: { id }, ...query});
    }

    async create(project: CreateProjectDto): Promise<Project> {
        return await this.projectRepository.save(project);
    }

    async update(id: string, project: UpdateProjectDto): Promise<Project> {
        await this.projectRepository.update(id, project);
        return await this.projectRepository.findOne({where: { id }});
    }
}
