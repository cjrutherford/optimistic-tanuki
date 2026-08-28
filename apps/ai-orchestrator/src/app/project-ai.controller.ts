import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ProjectAiCommands } from '@optimistic-tanuki/constants';
import { ProjectAiService, SummarisableProject } from './project-ai.service';
import { ProjectAgentService } from './project-agent.service';

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

  constructor(
    private readonly projectAi: ProjectAiService,
    private readonly agent: ProjectAgentService
  ) {}

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

  @MessagePattern({ cmd: ProjectAiCommands.PROPOSE })
  async propose(data: { project: SummarisableProject; today?: string }) {
    this.logger.log(`Proposing changes for project ${data?.project?.id}`);
    if (!data?.project?.id) {
      return {
        proposals: [],
        model: null,
        discarded: 0,
        unavailable: 'No project was supplied.',
      };
    }
    return await this.projectAi.proposeChanges(data.project, data.today);
  }

  /**
   * The agent doing the work, as the caller.
   *
   * The token is passed through rather than held here. The MCP surface is
   * authenticated-only and decides what may be touched from who is asking, so
   * an agent acting without one cannot act at all, and an agent acting as
   * somebody other than the caller would be worse than that.
   */
  @MessagePattern({ cmd: ProjectAiCommands.ACT })
  async act(data: { instruction: string; projectId: string; token: string }) {
    this.logger.log(`Agent acting on project ${data?.projectId}`);
    if (!data?.instruction || !data?.projectId || !data?.token) {
      return {
        said: '',
        used: [],
        awaitingApproval: false,
        model: null,
        unavailable: 'An instruction, a project and a token are all needed.',
      };
    }
    return await this.agent.act(data.instruction, data.projectId, data.token);
  }
}
