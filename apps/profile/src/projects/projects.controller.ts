import { Controller } from '@nestjs/common';
import { ProjectService } from '../app/project.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProjectCommands } from '@optimistic-tanuki/constants';
import { CreateProjectDto } from './dto/create-project.dto';
import { FindManyOptions } from 'typeorm';
import { Project } from './entities/project.entity';
import { UpdateProjectDto } from './dto/update-project.dto';

@Controller('projects')
export class ProjectsController {
    constructor(private readonly projectService: ProjectService) {}

    @MessagePattern({ cmd: ProjectCommands.Create })
    async create(@Payload() createProject: CreateProjectDto) {
        return await this.projectService.create(createProject);
    }

    @MessagePattern({ cmd: ProjectCommands.GetAll })
    async findAll(@Payload() query?: FindManyOptions<Project>) {
        return await this.projectService.findAll(query);
    }

    @MessagePattern({ cmd: ProjectCommands.Get })
    async findOne(@Payload('id') id: string, @Payload('query') query?: FindManyOptions<Project>) {
        return await this.projectService.findOne(id, query);
    }

    @MessagePattern({ cmd: ProjectCommands.Update })
    async update(@Payload('id') id: string, @Payload() updateProject: UpdateProjectDto) {
        return await this.projectService.update(id, updateProject);
    }
    
}
