import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ProjectAiCommands } from '@optimistic-tanuki/constants';
import { ProjectAiService, SummarisableProject } from './project-ai.service';

/**
 * The project-planning half of this service, alongside the wellness one.
 *
 * Takes the project as its payload rather than an id. This service has no
 * database and no business reading one: project-planning owns that data and
 * decides who may see it, so passing the project through keeps the
 * authorisation question where it is already answered.
 */
@Controller()
export class ProjectAiController {
  private readonly logger = new Logger(ProjectAiController.name);

  constructor(private readonly projectAi: ProjectAiService) {}

  @MessagePattern({ cmd: ProjectAiCommands.SUMMARISE })
  async summarise(data: { project: SummarisableProject; today?: string }) {
    this.logger.log(`Summarising project ${data?.project?.id}`);
    if (!data?.project?.id) {
      return {
        summary: null,
        model: null,
        discarded: 0,
        unavailable: 'No project was supplied.',
      };
    }
    return await this.projectAi.summarise(data.project, data.today);
  }
}
