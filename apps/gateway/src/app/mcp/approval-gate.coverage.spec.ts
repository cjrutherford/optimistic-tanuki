import { of } from 'rxjs';
import {
  ChangeCommands,
  ProjectCommands,
  ProjectJournalCommands,
  RiskCommands,
  TaskCommands,
} from '@optimistic-tanuki/constants';
import { ApprovalGate } from './approval-gate.service';
import { ChangeMcpService } from './change-mcp.service';
import { JournalMcpService } from './journal-mcp.service';
import { ProjectMcpService } from './project-mcp.service';
import { RiskMcpService } from './risk-mcp.service';
import { TaskMcpService } from './task-mcp.service';

/**
 * Every tool that writes, against a project that requires approval.
 *
 * The first version of this gate covered create_task and nothing else. Ten
 * other write tools went straight through, so an agent could still open risks,
 * file changes, rewrite journal entries and delete a whole project on a board
 * whose entire point is that a person decides. It read as protected and was
 * not.
 *
 * The test is written as a sweep rather than as one case per service, because
 * the failure was never a wrong implementation. It was a tool nobody
 * remembered. A sweep fails when the next tool is added without a gate.
 */
describe('the approval gate across every writing tool', () => {
  const profileId = 'profile-456';
  const request = { user: { profileId, userId: 'user-1' } };

  function stack(project: Record<string, unknown>) {
    const clientProxy = {
      send: jest.fn((pattern: { cmd: string }) => {
        if (pattern.cmd === ProjectCommands.FIND_ONE) return of(project);
        if (pattern.cmd === ProjectCommands.CREATE_AI_CHANGE)
          return of({ id: 'proposal-1', status: 'PENDING' });
        // Every find of an entity answers with the project it belongs to, the
        // way the real services do.
        if (
          [
            TaskCommands.FIND_ONE,
            RiskCommands.FIND_ONE,
            ChangeCommands.FIND_ONE,
            ProjectJournalCommands.FIND_ONE,
          ].includes(pattern.cmd)
        )
          return of({ id: 'entity-1', project: { id: 'proj-1' } });
        return of({ id: 'written' });
      }),
    };
    const gate = new ApprovalGate(clientProxy as never);
    return {
      clientProxy,
      tasks: new TaskMcpService(clientProxy as never, gate),
      risks: new RiskMcpService(clientProxy as never, gate),
      changes: new ChangeMcpService(clientProxy as never, gate),
      journal: new JournalMcpService(clientProxy as never, gate),
      projects: new ProjectMcpService(clientProxy as never, gate),
    };
  }

  const gated = { id: 'proj-1', requireHumanApproval: true };
  const ungated = { id: 'proj-1', requireHumanApproval: false };

  /** [what it is called, how to call it, the command it must not reach] */
  function writes(
    s: ReturnType<typeof stack>
  ): [string, () => Promise<unknown>, string][] {
    return [
      [
        'create_task',
        () =>
          s.tasks.createTask(
            { title: 't', projectId: 'proj-1' } as never,
            undefined,
            request
          ),
        TaskCommands.CREATE,
      ],
      [
        'update_task',
        () =>
          s.tasks.updateTask(
            { id: 'entity-1', title: 'x' },
            undefined,
            request
          ),
        TaskCommands.UPDATE,
      ],
      [
        'create_risk',
        () =>
          s.risks.createRisk(
            { projectId: 'proj-1', name: 'r' } as never,
            undefined,
            request
          ),
        RiskCommands.CREATE,
      ],
      [
        'update_risk',
        () =>
          s.risks.updateRisk(
            { riskId: 'entity-1', name: 'r' } as never,
            undefined,
            request
          ),
        RiskCommands.UPDATE,
      ],
      [
        'create_change',
        () =>
          s.changes.createChange(
            {
              projectId: 'proj-1',
              changeName: 'c',
              changeDescription: 'd',
            } as never,
            undefined,
            request
          ),
        ChangeCommands.CREATE,
      ],
      [
        'update_change',
        () =>
          s.changes.updateChange(
            { changeId: 'entity-1', changeDescription: 'd' } as never,
            undefined,
            request
          ),
        ChangeCommands.UPDATE,
      ],
      [
        'create_journal_entry',
        () =>
          s.journal.createJournalEntry(
            { projectId: 'proj-1', content: 'c' } as never,
            undefined,
            request
          ),
        ProjectJournalCommands.CREATE,
      ],
      [
        'update_journal_entry',
        () =>
          s.journal.updateJournalEntry(
            { id: 'entity-1', content: 'c' } as never,
            undefined,
            request
          ),
        ProjectJournalCommands.UPDATE,
      ],
      [
        'update_project',
        () =>
          s.projects.updateProject(
            { projectId: 'proj-1', name: 'n' } as never,
            undefined,
            request
          ),
        ProjectCommands.UPDATE,
      ],
    ];
  }

  describe('on a project that requires approval', () => {
    it.each(writes(stack(gated)).map(([name]) => name))(
      '%s proposes instead of writing',
      async (name) => {
        const s = stack(gated);
        const [, call, forbidden] = writes(s).find(([n]) => n === name);

        const result = (await call()) as { awaitingApproval?: boolean };

        expect(result.awaitingApproval).toBe(true);
        expect(s.clientProxy.send).toHaveBeenCalledWith(
          { cmd: ProjectCommands.CREATE_AI_CHANGE },
          expect.anything()
        );
        expect(s.clientProxy.send).not.toHaveBeenCalledWith(
          { cmd: forbidden },
          expect.anything()
        );
      }
    );
  });

  describe('on a project that does not', () => {
    it.each(writes(stack(ungated)).map(([name]) => name))(
      '%s does the work itself',
      async (name) => {
        const s = stack(ungated);
        const [, call, expected] = writes(s).find(([n]) => n === name);

        await call();

        expect(s.clientProxy.send).toHaveBeenCalledWith(
          { cmd: expected },
          expect.anything()
        );
        expect(s.clientProxy.send).not.toHaveBeenCalledWith(
          { cmd: ProjectCommands.CREATE_AI_CHANGE },
          expect.anything()
        );
      }
    );
  });

  /**
   * Deleting cannot be represented as a proposal, so on a gated project there
   * is no reviewable version of it. Leaving these open would make the
   * operations nobody can review also the only irreversible ones.
   */
  describe('deleting, which no proposal can stand in for', () => {
    const deletes: [
      string,
      (s: ReturnType<typeof stack>) => Promise<unknown>,
      string
    ][] = [
      [
        'delete_task',
        (s) => s.tasks.deleteTask({ taskId: 'entity-1' }, undefined, request),
        TaskCommands.DELETE,
      ],
      [
        'delete_risk',
        (s) => s.risks.deleteRisk({ riskId: 'entity-1' }, undefined, request),
        RiskCommands.REMOVE,
      ],
      [
        'delete_change',
        (s) =>
          s.changes.deleteChange({ changeId: 'entity-1' }, undefined, request),
        ChangeCommands.REMOVE,
      ],
      [
        'delete_project',
        (s) =>
          s.projects.deleteProject(
            { projectId: 'proj-1' } as never,
            undefined,
            request
          ),
        ProjectCommands.REMOVE,
      ],
    ];

    it.each(deletes)(
      '%s is refused, not performed',
      async (_name, call, cmd) => {
        const s = stack(gated);

        const result = (await call(s)) as { success: boolean };

        expect(result.success).toBe(false);
        expect(s.clientProxy.send).not.toHaveBeenCalledWith(
          { cmd },
          expect.anything()
        );
      }
    );

    it.each(deletes)(
      '%s goes ahead when the project is not gated',
      async (_name, call, cmd) => {
        const s = stack(ungated);

        await call(s);

        expect(s.clientProxy.send).toHaveBeenCalledWith(
          { cmd },
          expect.anything()
        );
      }
    );
  });

  /**
   * A new project has no project to gate against, so create_project cannot be
   * proposed. Allowing it ungated would put an agent one call away from a
   * workspace it can write to freely, which is the gate removed rather than
   * honoured.
   */
  it('creates a project with the gate already on', async () => {
    const s = stack(ungated);

    await s.projects.createProject(
      { name: 'New', description: 'd' } as never,
      undefined,
      request
    );

    expect(s.clientProxy.send).toHaveBeenCalledWith(
      { cmd: ProjectCommands.CREATE },
      expect.objectContaining({ requireHumanApproval: true })
    );
  });

  it('refuses to write when it cannot tell whether the project is gated', async () => {
    // A project that cannot be read is not a project without a gate.
    const clientProxy = {
      send: jest.fn((pattern: { cmd: string }) => {
        if (pattern.cmd === ProjectCommands.FIND_ONE) {
          throw new Error('project-planning is down');
        }
        return of({ id: 'written' });
      }),
    };
    const tasks = new TaskMcpService(
      clientProxy as never,
      new ApprovalGate(clientProxy as never)
    );

    await expect(
      tasks.createTask(
        { title: 't', projectId: 'proj-1' } as never,
        undefined,
        request
      )
    ).rejects.toThrow(/requires approval/);
    expect(clientProxy.send).not.toHaveBeenCalledWith(
      { cmd: TaskCommands.CREATE },
      expect.anything()
    );
  });
});
