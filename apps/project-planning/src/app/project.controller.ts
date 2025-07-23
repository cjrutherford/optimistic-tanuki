import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProjectService } from './project.service';
import { CreateProjectDto, UpdateProjectDto } from '@optimistic-tanuki/models'; 
import { ProjectCommands } from '@optimistic-tanuki/constants';

@Controller()
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @MessagePattern(ProjectCommands.CREATE)
  create(@Payload() createProjectDto: CreateProjectDto) {
    return this.projectService.create(createProjectDto);
  }

  @MessagePattern(ProjectCommands.FIND_ALL)
  findAll() {
    return this.projectService.findAll();
  }

  @MessagePattern(ProjectCommands.FIND_ONE)
  findOne(@Payload() id: number) {
    return this.projectService.findOne(id);
  }

  @MessagePattern(ProjectCommands.UPDATE)
  update(@Payload() updateProjectDto: UpdateProjectDto) {
    return this.projectService.update(updateProjectDto.id, updateProjectDto);
  }

  @MessagePattern(ProjectCommands.REMOVE)
  remove(@Payload() id: number) {
    return this.projectService.remove(id);
  }
}
