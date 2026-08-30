import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { ProjectAiCommands } from '@optimistic-tanuki/constants';
import { ProjectAiService, SummarisableProject } from './project-ai.service';
import {
  AgentRunResult,
  AgentTurn,
  ProjectAgentService,
} from './project-agent.service';

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
  async act(data: {
    instruction: string;
    projectId: string;
    token: string;
    history?: AgentTurn[];
  }) {
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
    return await this.agent.act(
      data.instruction,
      data.projectId,
      data.token,
      data.history ?? []
    );
  }

  /**
   * The same run, reported as it happens.
   *
   * A message handler returning an Observable streams every emission back to
   * the caller rather than one reply at the end, which is what lets the panel
   * show the agent reading a project while it reads it. The run takes a minute
   * or more, and silence for that long looks like a fault.
   *
   * The last emission carries the result, so a caller that only wants the
   * answer can ignore everything before it.
   */
  @MessagePattern({ cmd: ProjectAiCommands.ACT_STREAM })
  actStreaming(data: {
    instruction: string;
    projectId: string;
    token: string;
    history?: AgentTurn[];
  }): Observable<AgentProgress> {
    return new Observable<AgentProgress>((subscriber) => {
      if (!data?.instruction || !data?.projectId || !data?.token) {
        subscriber.next({
          type: 'done',
          result: {
            said: '',
            used: [],
            awaitingApproval: false,
            model: null,
            unavailable:
              'An instruction, a project and a token are all needed.',
          },
        });
        subscriber.complete();
        return;
      }

      this.logger.log(`Agent acting on project ${data.projectId}, streaming`);
      this.agent
        .act(
          data.instruction,
          data.projectId,
          data.token,
          data.history ?? [],
          (call) => subscriber.next({ type: 'tool', tool: call.tool })
        )
        .then((result) => {
          subscriber.next({ type: 'done', result });
          subscriber.complete();
        })
        .catch((error) => {
          // Reported as a finished run rather than an error, so a caller
          // reading the stream always ends with something to show.
          subscriber.next({
            type: 'done',
            result: {
              said: '',
              used: [],
              awaitingApproval: false,
              model: null,
              unavailable: `The assistant stopped: ${error.message}`,
            },
          });
          subscriber.complete();
        });
    });
  }
}

/** What the caller sees while the agent works, then what it produced. */
export type AgentProgress =
  | { type: 'tool'; tool: string }
  | { type: 'done'; result: AgentRunResult };
