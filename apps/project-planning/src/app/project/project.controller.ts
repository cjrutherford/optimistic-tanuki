import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProjectService } from './project.service';
import {
  CreateProjectDto,
  QueryProjectDto,
  UpdateProjectDto,
} from '@optimistic-tanuki/models';
import { ProjectCommands } from '@optimistic-tanuki/constants';

@Controller()
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @MessagePattern({ cmd: ProjectCommands.CREATE })
  async create(@Payload() createProjectDto: CreateProjectDto) {
    return await this.projectService.create(createProjectDto);
  }

  @MessagePattern({ cmd: ProjectCommands.FIND_ALL })
  async findAll(
    @Payload() query: QueryProjectDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...q } = query;
    return await this.projectService.findAll(q, requestingUserId);
  }

  @MessagePattern({ cmd: ProjectCommands.FIND_ONE })
  async findOne(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.projectService.findOne(id, requestingUserId);
  }

  @MessagePattern({ cmd: ProjectCommands.UPDATE })
  async update(
    @Payload()
    updateProjectDto: UpdateProjectDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...dto } = updateProjectDto;
    return await this.projectService.update(dto.id, dto, requestingUserId);
  }

  @MessagePattern({ cmd: ProjectCommands.REMOVE })
  async remove(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.projectService.remove(id, requestingUserId);
  }
}
