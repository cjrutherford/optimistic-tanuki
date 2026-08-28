import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ChangeCommands,
  ProjectCommands,
  ProjectJournalCommands,
  RiskCommands,
  ServiceTokens,
  TaskCommands,
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

/**
 * The gate, in one place, for every tool that writes.
 *
 * A project can require that changes are approved by a person before they
 * happen. The MCP tools are the path an agent takes, so this is where the flag
 * has to be honoured, and it has to be honoured on all of them: gating
 * create_task alone left ten other write tools going straight through, so an
 * agent could still open risks, file changes and write journal entries on a
 * project whose whole point is that a person decides.
 *
 * It lived inside the task service first. Copying it into four more services
 * would have meant five places to keep in step, and the one that drifted would
 * be a hole nobody noticed.
 */

/** What a gated tool should tell the caller instead of doing the work. */
export interface Proposed {
  success: true;
  message: string;
  proposal: unknown;
  awaitingApproval: true;
}

@Injectable()
export class ApprovalGate {
  private readonly logger = new Logger(ApprovalGate.name);

  constructor(
    @Inject(ServiceTokens.PROJECT_PLANNING_SERVICE)
    private readonly projectPlanning: ClientProxy
  ) {}

  /**
   * Files the change for review when the project requires it.
   *
   * Returns what the tool should hand back, or null when the caller should go
   * ahead and do the work itself.
   */
  async proposeIfGated(
    projectId: string,
    operation: string,
    payload: object,
    requestingUserId: string,
    describe: string
  ): Promise<Proposed | null> {
    if (!(await this.requiresApproval(projectId, requestingUserId))) {
      return null;
    }

    const proposal = await firstValueFrom(
      this.projectPlanning.send(
        { cmd: ProjectCommands.CREATE_AI_CHANGE },
        { projectId, proposedBy: requestingUserId, operation, payload }
      )
    );

    return {
      success: true,
      // Said plainly, because an agent told "created successfully" tells the
      // person the same, and nothing was created.
      message:
        `${describe} was proposed and is waiting for approval. ` +
        `It has not happened yet.`,
      proposal,
      awaitingApproval: true,
    };
  }

  /**
   * Refuses outright, for the operations a proposal cannot represent.
   *
   * Deleting is not something the executor can carry out, so on a gated
   * project there is no reviewable version of it. Leaving those open would
   * make the operations nobody can review also the only irreversible ones.
   */
  async refuseIfGated(
    projectId: string,
    requestingUserId: string,
    what: string
  ): Promise<{ success: false; message: string } | null> {
    if (!(await this.requiresApproval(projectId, requestingUserId))) {
      return null;
    }
    return {
      success: false,
      message:
        `This project requires changes to be approved by a person, and ` +
        `${what} cannot be proposed for approval. A person has to do it.`,
    };
  }

  async requiresApproval(
    projectId: string,
    requestingUserId: string
  ): Promise<boolean> {
    const project = await this.projectOrThrow(projectId, requestingUserId);
    return !!project?.requireHumanApproval;
  }

  private async projectOrThrow(
    projectId: string,
    requestingUserId: string
  ): Promise<{ requireHumanApproval?: boolean } | null> {
    try {
      return await firstValueFrom(
        this.projectPlanning.send(
          { cmd: ProjectCommands.FIND_ONE },
          { id: projectId, requestingUserId }
        )
      );
    } catch (error) {
      // A project that cannot be read is not a project without a gate. Saying
      // so beats letting the write past on the strength of a failed lookup.
      throw new Error(
        `Could not check whether project ${projectId} requires approval: ${error.message}`
      );
    }
  }

  /**
   * The project an entity belongs to.
   *
   * The update and delete tools take the entity's id and, at best, an optional
   * project id. The entity's own project is the answer: an update to a gated
   * project must not slip through because the argument was left out or was
   * pointed somewhere else.
   */
  async projectOfTask(id: string, requestingUserId: string) {
    return this.projectOf(TaskCommands.FIND_ONE, id, requestingUserId);
  }

  async projectOfRisk(id: string, requestingUserId: string) {
    return this.projectOf(RiskCommands.FIND_ONE, id, requestingUserId);
  }

  async projectOfChange(id: string, requestingUserId: string) {
    return this.projectOf(ChangeCommands.FIND_ONE, id, requestingUserId);
  }

  async projectOfJournalEntry(id: string, requestingUserId: string) {
    return this.projectOf(
      ProjectJournalCommands.FIND_ONE,
      id,
      requestingUserId
    );
  }

  private async projectOf(
    cmd: string,
    id: string,
    requestingUserId: string
  ): Promise<string | null> {
    const entity = await firstValueFrom(
      this.projectPlanning.send({ cmd }, { id, requestingUserId })
    );
    return entity?.projectId ?? entity?.project?.id ?? null;
  }
}
