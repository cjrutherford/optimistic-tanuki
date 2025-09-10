import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProjectService } from './project.service';
import { CreateProjectDto, QueryProjectDto, UpdateProjectDto } from '@optimistic-tanuki/models'; 
import { ProjectCommands } from '@optimistic-tanuki/constants';

@Controller()
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @MessagePattern({ cmd: ProjectCommands.CREATE })
  async create(@Payload() createProjectDto: CreateProjectDto) {
    return await this.projectService.create(createProjectDto);
  }

  @MessagePattern({ cmd: ProjectCommands.FIND_ALL })
  async findAll(@Payload() query: QueryProjectDto) {
    return await this.projectService.findAll(query);
  }

  @MessagePattern({ cmd: ProjectCommands.FIND_ONE })
  async findOne(@Payload() id: string) {
    return await this.projectService.findOne(id);
  }

  @MessagePattern({ cmd: ProjectCommands.UPDATE })
  async update(@Payload() updateProjectDto: UpdateProjectDto) {
    return await this.projectService.update(updateProjectDto.id, updateProjectDto);
  }

  @MessagePattern({ cmd: ProjectCommands.REMOVE })
  async remove(@Payload() id: string) {
    return await this.projectService.remove(id);
  }
}
