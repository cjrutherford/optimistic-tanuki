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

/**
 * Acting as the caller when the caller is a browser.
 *
 * The app signs in with a cookie, not a bearer header. Reading the token off
 * the Authorization header made the agent route work from a script and fail
 * for every real user, with an error that read like the assistant being down.
 */
describe('the token the agent acts with', () => {
  it('comes from the credential the guard resolved, however it arrived', async () => {
    const { ProjectPlanningController } = await import(
      '../../controllers/project-planning/project-planning.controller'
    );
    const sent: unknown[] = [];
    const ai = {
      send: jest.fn((_pattern, payload) => {
        sent.push(payload);
        return of({ said: 'ok', used: [] });
      }),
    };
    const controller = new ProjectPlanningController(
      { send: jest.fn(() => of({ id: 'proj-1' })) } as never,
      ai as never,
      // Sending is a courtesy after the record is safe; this is about the gate.
      { send: jest.fn() } as never,
      { send: jest.fn() } as never,
      { send: jest.fn() } as never
    );

    await controller.actOnProject(
      'proj-1',
      { instruction: 'do a thing' },
      { credential: 'the-cookie-token' }
    );

    expect(sent[0]).toMatchObject({ token: 'the-cookie-token' });
  });

  it('refuses rather than calling out with no token at all', async () => {
    const { ProjectPlanningController } = await import(
      '../../controllers/project-planning/project-planning.controller'
    );
    const ai = { send: jest.fn() };
    const controller = new ProjectPlanningController(
      { send: jest.fn() } as never,
      ai as never,
      { send: jest.fn() } as never,
      { send: jest.fn() } as never,
      { send: jest.fn() } as never
    );

    await expect(
      controller.actOnProject('proj-1', { instruction: 'do a thing' }, {})
    ).rejects.toThrow(/signed in caller/);
    expect(ai.send).not.toHaveBeenCalled();
  });
});

/**
 * What a list tool hands back.
 *
 * A list used to arrive as whole rows with every id and timestamp on them, and
 * the count came after the rows, so shortening the result removed the count
 * while leaving twenty thousand characters of bookkeeping. The assistant then
 * counted the visible rows by eye and got it wrong.
 */
describe('the shape of a list result', () => {
  const request = { user: { profileId: 'p', userId: 'u' } };

  function tasksService(rows: Record<string, unknown>[]) {
    const clientProxy = { send: jest.fn(() => of(rows)) };
    return new TaskMcpService(
      clientProxy as never,
      new ApprovalGate(clientProxy as never)
    );
  }

  const row = {
    id: 't1',
    title: 'Book the crane',
    status: 'TODO',
    priority: 'HIGH',
    createdBy: 'someone',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-02',
    deletedAt: null,
  };

  it('puts the count before the rows, so shortening cannot remove it', async () => {
    const service = tasksService([row, { ...row, id: 't2' }]);

    const result = await service.listTasks(
      { projectId: 'proj-1' } as never,
      undefined,
      request
    );

    const order = Object.keys(result);
    expect(order.indexOf('count')).toBeLessThan(order.indexOf('tasks'));
    expect(result.count).toBe(2);
  });

  it('narrows each row by default rather than sending the bookkeeping', async () => {
    const service = tasksService([row]);

    const result = await service.listTasks(
      { projectId: 'proj-1' } as never,
      undefined,
      request
    );

    expect(result.tasks[0]).toHaveProperty('title');
    expect(result.tasks[0]).not.toHaveProperty('updatedAt');
    expect(result.omittedFields).toContain('updatedAt');
  });

  it('keeps the count as the total when only a page comes back', async () => {
    // The trap. Counting the rows after slicing reports the page size as the
    // answer, so two hundred tasks would say twenty five and mean it. The
    // assistant has already answered a count question wrong twice from a list
    // it could only partly see.
    const many = Array.from({ length: 200 }, (_, i) => ({
      ...row,
      id: `t${i}`,
    }));
    const service = tasksService(many);

    const result = await service.listTasks(
      { projectId: 'proj-1' } as never,
      undefined,
      request
    );

    expect(result.count).toBe(200);
    expect(result.showing).toBe(25);
    expect(result.tasks).toHaveLength(25);
    expect(result.more).toBe(true);
  });

  it('can be asked for the page after the first', async () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      ...row,
      id: `t${i}`,
    }));
    const service = tasksService(many);

    const result = await service.listTasks(
      { projectId: 'proj-1', offset: 190 } as never,
      undefined,
      request
    );

    expect(result.offset).toBe(190);
    expect(result.showing).toBe(10);
    expect(result.more).toBe(false);
    expect(result.count).toBe(200);
  });

  it('says everything came back when it did', async () => {
    const service = tasksService([row, { ...row, id: 't2' }]);

    const result = await service.listTasks(
      { projectId: 'proj-1' } as never,
      undefined,
      request
    );

    expect(result).toMatchObject({ count: 2, showing: 2, more: false });
  });

  it('hands back whole rows when the caller asks for them', async () => {
    const service = tasksService([row]);

    const result = await service.listTasks(
      { projectId: 'proj-1', view: 'full' } as never,
      undefined,
      request
    );

    expect(result.tasks[0]).toEqual(row);
    expect(result.omittedFields).toBeUndefined();
  });
});

/**
 * The tool that answers with a number.
 *
 * Asked how many tasks a project had, the assistant answered four, then seven.
 * There were twelve. Each time it was handed the list and asked to count it by
 * eye, and each time the count in the payload had been cut off. Counting is
 * arithmetic; it belongs in one query, not in a model's attention.
 */
describe('count_tasks', () => {
  const request = { user: { profileId: 'p', userId: 'u' } };

  function serviceWith(rows: Record<string, unknown>[]) {
    const clientProxy = { send: jest.fn(() => of(rows)) };
    return new TaskMcpService(
      clientProxy as never,
      new ApprovalGate(clientProxy as never)
    );
  }

  const twelve = [
    ...Array.from({ length: 7 }, (_, i) => ({
      id: `t${i}`,
      status: 'TODO',
      priority: 'MEDIUM',
      assignee: 'someone',
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `d${i}`,
      status: 'DONE',
      priority: 'HIGH',
      assignee: null,
    })),
  ];

  it('answers with the total rather than a list to count', async () => {
    const result = await serviceWith(twelve).countTasks(
      { projectId: 'p1' },
      undefined,
      request
    );

    expect(result.total).toBe(12);
    expect(result).not.toHaveProperty('tasks');
  });

  it('breaks it down the ways somebody actually asks', async () => {
    const result = await serviceWith(twelve).countTasks(
      { projectId: 'p1' },
      undefined,
      request
    );

    expect(result.byStatus).toEqual({ TODO: 7, DONE: 5 });
    expect(result.byPriority).toEqual({ MEDIUM: 7, HIGH: 5 });
    expect(result.unassigned).toBe(5);
  });

  it('counts a project with nothing on it as nothing', async () => {
    const result = await serviceWith([]).countTasks(
      { projectId: 'p1' },
      undefined,
      request
    );

    expect(result.total).toBe(0);
    expect(result.byStatus).toEqual({});
  });

  it('does not drop a row for want of a status', async () => {
    // A row missing the field it is tallied by would otherwise vanish from a
    // total that is supposed to account for everything.
    const result = await serviceWith([{ id: 'x' }]).countTasks(
      { projectId: 'p1' },
      undefined,
      request
    );

    expect(result.total).toBe(1);
    expect(result.byStatus).toEqual({ UNKNOWN: 1 });
  });
});
