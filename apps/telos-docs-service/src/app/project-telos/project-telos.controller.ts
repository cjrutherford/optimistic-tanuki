import { Controller } from '@nestjs/common';
import { ProjectTelosService } from './project-telos.service';
import { ProjectTelosCommands } from '@optimistic-tanuki/constants';
import { CreateProjectTelosDto, QueryProjectTelosDto, UpdateProjectTelosDto } from '@optimistic-tanuki/models';
import { MessagePattern } from '@nestjs/microservices';

@Controller('project-telos')
export class ProjectTelosController {
    constructor(private readonly projectTelosService: ProjectTelosService) {}

    @MessagePattern({ cmd: ProjectTelosCommands.CREATE })
    async create(data: CreateProjectTelosDto) {
        return await this.projectTelosService.create(data);
    }


    @MessagePattern({ cmd: ProjectTelosCommands.UPDATE })
    async update(data: UpdateProjectTelosDto) {
        return await this.projectTelosService.update(data.id, data);
    }

    @MessagePattern({ cmd: ProjectTelosCommands.DELETE })
    async remove(id: string) {
        return await this.projectTelosService.remove(id);
    }

    @MessagePattern({ cmd: ProjectTelosCommands.FIND_ONE })
    async findOne(id: string) {
        return await this.projectTelosService.findOne(id);
    }

    @MessagePattern({ cmd: ProjectTelosCommands.FIND })
    async findAll(data: QueryProjectTelosDto) {
        return await this.projectTelosService.findAll(data);
    }
}