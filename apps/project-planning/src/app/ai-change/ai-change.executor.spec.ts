import { AiChangeExecutor } from './ai-change.executor';

/**
 * Approving a change has to actually do it, and must not be able to do more
 * than what was approved.
 *
 * Before this existed, approval wrote a status and stopped. The table recorded
 * intentions nobody carried out, which is a worse position than having no
 * table: the flow looked complete from the outside.
 */
describe('AiChangeExecutor', () => {
  function executorWith() {
    const services = {
      tasks: {
        create: jest.fn(async () => ({ id: 'new-task' })),
        update: jest.fn(async () => ({ id: 't1' })),
      },
      risks: {
        create: jest.fn(async () => ({ id: 'new-risk' })),
        update: jest.fn(async () => ({ id: 'r1' })),
      },
      changes: {
        create: jest.fn(async () => ({ id: 'new-change' })),
        update: jest.fn(async () => ({ id: 'c1' })),
      },
      journals: {
        create: jest.fn(async () => ({ id: 'new-journal' })),
        update: jest.fn(async () => ({ id: 'j1' })),
      },
      taskNotes: {
        create: jest.fn(async () => ({ id: 'new-note' })),
        update: jest.fn(async () => ({ id: 'n1' })),
      },
      projects: { update: jest.fn(async () => ({ id: 'p1' })) },
    };
    const executor = new AiChangeExecutor(
      services.tasks as never,
      services.risks as never,
      services.changes as never,
      services.journals as never,
      services.taskNotes as never,
      services.projects as never
    );
    return { executor, services };
  }

  it.each([
    ['task.create', 'tasks'],
    ['risk.create', 'risks'],
    ['change.create', 'changes'],
    ['projectJournal.create', 'journals'],
    ['taskNote.create', 'taskNotes'],
  ])('applies %s through the service that owns it', async (op, key) => {
    const { executor, services } = executorWith();

    const result = await executor.apply(op, { title: 'x' }, 'p1', 'reviewer');

    expect(result.applied).toBe(true);
    expect(result.entityId).toBeTruthy();
    expect(
      (services as unknown as Record<string, { create: jest.Mock }>)[key].create
    ).toHaveBeenCalled();
  });

  it('passes the id separately for an update, since that signature differs', async () => {
    const { executor, services } = executorWith();

    await executor.apply(
      'task.update',
      { id: 't1', status: 'DONE' },
      'p1',
      'r'
    );

    expect(services.tasks.update).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ status: 'DONE' }),
      'r'
    );
  });

  it('refuses an update with no task to update', async () => {
    const { executor } = executorWith();

    const result = await executor.apply(
      'task.update',
      { status: 'DONE' },
      'p1',
      'r'
    );

    expect(result.applied).toBe(false);
    expect(result.error).toMatch(/needs the id/);
  });

  describe('what it will not do', () => {
    it('refuses an operation nobody allowed', async () => {
      // `operation` is a free string written from a request. Without this, an
      // approved change could name any command the service exposes.
      const { executor, services } = executorWith();

      const result = await executor.apply(
        'project.remove',
        { id: 'p1' },
        'p1',
        'reviewer'
      );

      expect(result.applied).toBe(false);
      expect(result.error).toMatch(/not one this can apply/);
      expect(services.tasks.create).not.toHaveBeenCalled();
    });

    it('writes to the project the change was filed against, not the payload', async () => {
      // A reviewer approved a change on one project. A project id buried in
      // the payload must not redirect it somewhere they never looked.
      const { executor, services } = executorWith();

      await executor.apply(
        'task.create',
        { title: 'x', projectId: 'somebody-elses-project' },
        'the-approved-project',
        'reviewer'
      );

      expect(services.tasks.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'the-approved-project' }),
        'reviewer'
      );
    });
  });

  it('reports a failure to apply rather than swallowing it', async () => {
    // Otherwise the row reads APPROVED and the reviewer believes the board
    // changed when it did not.
    const { executor, services } = executorWith();
    services.tasks.create.mockRejectedValue(new Error('database is down'));

    const result = await executor.apply('task.create', {}, 'p1', 'r');

    expect(result.applied).toBe(false);
    expect(result.error).toBe('database is down');
  });

  /**
   * The fields these services will not save without.
   *
   * A risk takes riskOwner and uses it as createdBy. A journal entry and a
   * note take profileId. A change takes requestor. None of them is nullable,
   * and a model writing a proposal supplies none of them, so without this
   * every approval of those ends in a not-null violation: approved, and
   * nothing on the board.
   */
  describe('who is recorded as responsible', () => {
    it.each([
      ['risk.create', 'risks', 'riskOwner'],
      ['projectJournal.create', 'journals', 'profileId'],
      ['taskNote.create', 'taskNotes', 'profileId'],
      ['change.create', 'changes', 'requestor'],
    ])('fills %s with the approver', async (op, key, field) => {
      const { executor, services } = executorWith();

      await executor.apply(op, { title: 'x' }, 'p1', 'the-reviewer');

      expect(
        (services as unknown as Record<string, { create: jest.Mock }>)[key]
          .create
      ).toHaveBeenCalledWith(
        expect.objectContaining({ [field]: 'the-reviewer' }),
        'the-reviewer'
      );
    });

    it('leaves an owner the payload already names alone', async () => {
      const { executor, services } = executorWith();

      await executor.apply(
        'projectJournal.create',
        { content: 'x', profileId: 'somebody-else' },
        'p1',
        'the-reviewer'
      );

      expect(services.journals.create).toHaveBeenCalledWith(
        expect.objectContaining({ profileId: 'somebody-else' }),
        'the-reviewer'
      );
    });
  });

  /**
   * The rest of what a gated tool can now propose.
   *
   * Gating the update tools is only half a feature: an approved update that
   * nothing can carry out is a row that can only ever be approved and then
   * fail.
   */
  describe('changing things that already exist', () => {
    it.each([
      ['risk.update', 'risks'],
      ['change.update', 'changes'],
      ['projectJournal.update', 'journals'],
      ['taskNote.update', 'taskNotes'],
    ])('applies %s through the service that owns it', async (op, key) => {
      const { executor, services } = executorWith();

      const result = await executor.apply(
        op,
        { id: 'e1', content: 'changed' },
        'p1',
        'reviewer'
      );

      expect(result.applied).toBe(true);
      expect(
        (services as unknown as Record<string, { update: jest.Mock }>)[key]
          .update
      ).toHaveBeenCalledWith(
        'e1',
        expect.objectContaining({ content: 'changed' }),
        'reviewer'
      );
    });

    it.each(['risk.update', 'change.update', 'projectJournal.update'])(
      'refuses %s with nothing to change',
      async (op) => {
        const { executor } = executorWith();

        const result = await executor.apply(op, { x: 1 }, 'p1', 'r');

        expect(result.applied).toBe(false);
        expect(result.error).toMatch(/needs the id/);
      }
    );
  });

  describe('changing the project itself', () => {
    it('changes the project the proposal was filed against', async () => {
      const { executor, services } = executorWith();

      await executor.apply(
        'project.update',
        { id: 'some-other-project', name: 'Renamed' },
        'the-approved-project',
        'reviewer'
      );

      expect(services.projects.update).toHaveBeenCalledWith(
        'the-approved-project',
        expect.objectContaining({ name: 'Renamed' }),
        'reviewer'
      );
    });

    it.each(['requireHumanApproval', 'owner', 'createdBy'])(
      'will not let an approved change set %s',
      async (field) => {
        // requireHumanApproval is the gate. A proposal able to turn it off
        // would be one approval away from removing the need for any further
        // approval: the whole protection spent in a single use.
        const { executor, services } = executorWith();

        await executor.apply(
          'project.update',
          {
            [field]: field === 'requireHumanApproval' ? false : 'somebody',
            name: 'Renamed',
          },
          'p1',
          'reviewer'
        );

        expect(services.projects.update).toHaveBeenCalledWith(
          'p1',
          expect.not.objectContaining({ [field]: expect.anything() }),
          'reviewer'
        );
      }
    );
  });
});
