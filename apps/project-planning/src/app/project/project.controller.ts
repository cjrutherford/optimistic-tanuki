import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProjectService } from './project.service';
import {
  CreateProjectDto,
  QueryProjectDto,
  UpdateProjectDto,
} from '@optimistic-tanuki/models';
import { ProjectCommands } from '@optimistic-tanuki/constants';
import {
  CreateAiChangeDto,
  ReviewAiChangeDto,
} from '@optimistic-tanuki/models';
import { AiChangeService } from '../ai-change/ai-change.service';

@Controller()
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly aiChangeService: AiChangeService
  ) {}

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

  @MessagePattern({ cmd: ProjectCommands.CREATE_AI_CHANGE })
  createAiChange(@Payload() dto: CreateAiChangeDto) {
    return this.aiChangeService.create(dto);
  }

  @MessagePattern({ cmd: ProjectCommands.FIND_AI_CHANGES })
  findAiChanges(@Payload('projectId') projectId: string) {
    return this.aiChangeService.findAll(projectId);
  }

  @MessagePattern({ cmd: ProjectCommands.REVIEW_AI_CHANGE })
  reviewAiChange(
    @Payload() payload: ReviewAiChangeDto & { reviewedBy: string }
  ) {
    return this.aiChangeService.review(payload, payload.reviewedBy);
  }
}
