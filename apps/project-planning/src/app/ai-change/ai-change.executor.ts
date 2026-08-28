import { Injectable, Logger } from '@nestjs/common';
import { TaskService } from '../task/task.service';
import { RiskService } from '../risk/risk.service';
import { ChangeService } from '../change/change.service';
import { ProjectJournalService } from '../project-journal/project-journal.service';
import { TaskNoteService } from '../task-note/task-note.service';

/**
 * Performs a change a human has approved.
 *
 * Until this existed, approving an AI change set a status and stopped. Nothing
 * anywhere read an approved row and did what it described, so the entire
 * proposal flow was a table that recorded intentions nobody acted on.
 *
 * Two rules hold the safety story together.
 *
 * Only operations on this list can run. `operation` is a free string on the
 * row, and the row is written from a request, so without an allowlist an
 * approved change could name any command the service exposes. Deleting a
 * project is not something a proposal should be able to become.
 *
 * The payload's project is forced to the project the change was filed
 * against. A proposal approved on one project must not be able to write to
 * another, whatever its payload says, and the reviewer approved what they were
 * shown rather than a project id buried in it.
 */

export type ApplicableOperation =
  | 'task.create'
  | 'task.update'
  | 'risk.create'
  | 'change.create'
  | 'projectJournal.create'
  | 'taskNote.create';

export const APPLICABLE_OPERATIONS: ApplicableOperation[] = [
  'task.create',
  'task.update',
  'risk.create',
  'change.create',
  'projectJournal.create',
  'taskNote.create',
];

export interface ApplyResult {
  applied: boolean;
  /** What was created or changed, so the row records more than a status. */
  entityId?: string;
  error?: string;
}

@Injectable()
export class AiChangeExecutor {
  private readonly logger = new Logger(AiChangeExecutor.name);

  constructor(
    private readonly tasks: TaskService,
    private readonly risks: RiskService,
    private readonly changes: ChangeService,
    private readonly journals: ProjectJournalService,
    private readonly taskNotes: TaskNoteService
  ) {}

  canApply(operation: string): operation is ApplicableOperation {
    return (APPLICABLE_OPERATIONS as string[]).includes(operation);
  }

  async apply(
    operation: string,
    payload: Record<string, unknown>,
    projectId: string,
    approvedBy: string
  ): Promise<ApplyResult> {
    if (!this.canApply(operation)) {
      // Refused rather than attempted. An operation nobody allowed is a
      // defect somewhere upstream, and running it would be the wrong way to
      // find that out.
      return {
        applied: false,
        error: `Operation ${operation} is not one this can apply`,
      };
    }

    // The reviewer approved a change filed against this project. Whatever the
    // payload says about which project it belongs to, this is the answer.
    const scoped = this.withOwner({ ...payload, projectId }, approvedBy);

    try {
      const created = await this.dispatch(operation, scoped, approvedBy);
      return { applied: true, entityId: (created as { id?: string })?.id };
    } catch (error) {
      this.logger.warn(
        `Approved change ${operation} failed to apply: ${
          (error as Error).message
        }`
      );
      return { applied: false, error: (error as Error).message };
    }
  }

  /**
   * Fills in who is responsible, from the person who approved it.
   *
   * These services need an owner and will not save without one: a risk takes
   * riskOwner and uses it as createdBy, a journal entry and a note take
   * profileId, a change takes requestor. A proposal is written by a model and
   * carries none of them, so without this every approval of those three ends
   * in a not-null violation, which is the exact shape of failure this flow was
   * built to avoid: approved, and then nothing on the board.
   *
   * The approver is the right answer rather than the proposer. They are the
   * one taking responsibility for it happening.
   */
  private withOwner(
    payload: Record<string, unknown>,
    approvedBy: string
  ): Record<string, unknown> {
    return {
      ...payload,
      riskOwner: payload.riskOwner ?? approvedBy,
      profileId: payload.profileId ?? approvedBy,
      requestor: payload.requestor ?? approvedBy,
      createdBy: payload.createdBy ?? approvedBy,
    };
  }

  private async dispatch(
    operation: ApplicableOperation,
    payload: Record<string, unknown>,
    approvedBy: string
  ): Promise<unknown> {
    switch (operation) {
      case 'task.create':
        return await this.tasks.create(payload as never, approvedBy);
      case 'task.update': {
        // update takes the id separately, unlike the create methods.
        const { id, ...rest } = payload as { id?: string };
        if (!id) throw new Error('task.update needs the id of a task');
        return await this.tasks.update(id, rest as never, approvedBy);
      }
      case 'risk.create':
        return await this.risks.create(payload as never, approvedBy);
      case 'change.create':
        return await this.changes.create(payload as never, approvedBy);
      case 'projectJournal.create':
        return await this.journals.create(payload as never, approvedBy);
      case 'taskNote.create':
        return await this.taskNotes.create(payload as never, approvedBy);
    }
  }
}
