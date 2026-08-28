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
      risks: { create: jest.fn(async () => ({ id: 'new-risk' })) },
      changes: { create: jest.fn(async () => ({ id: 'new-change' })) },
      journals: { create: jest.fn(async () => ({ id: 'new-journal' })) },
      taskNotes: { create: jest.fn(async () => ({ id: 'new-note' })) },
    };
    const executor = new AiChangeExecutor(
      services.tasks as never,
      services.risks as never,
      services.changes as never,
      services.journals as never,
      services.taskNotes as never
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
      (services as Record<string, { create: jest.Mock }>)[key].create
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
});
