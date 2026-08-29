import { AiChangeService } from './ai-change.service';

/**
 * The access check these three handlers were written without.
 *
 * Every other command in this service scopes to the caller. These did not, so
 * anyone holding the project-planning read permission could list the pending
 * proposals of a project they have no part in and read their full payloads,
 * and anyone with the update permission could settle a decision that was not
 * theirs to make.
 */
describe('AI changes and who may reach them', () => {
  const OWNER = 'owner-profile';
  const STRANGER = 'someone-else';

  function serviceWith(
    change: Record<string, unknown> | null = {
      id: 'c1',
      projectId: 'p1',
      status: 'PENDING',
      operation: 'task.create',
      payload: {},
    }
  ) {
    const repository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(change),
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => row),
    };
    const projects = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'p1', owner: OWNER, members: [] }),
    };
    const executor = {
      canApply: jest.fn(() => true),
      apply: jest.fn(async () => ({ applied: true, entityId: 'new' })),
    };
    return {
      service: new AiChangeService(
        repository as never,
        projects as never,
        executor as never
      ),
      repository,
      executor,
    };
  }

  describe('a stranger to the project', () => {
    it('cannot list its proposals', async () => {
      const { service, repository } = serviceWith();

      await expect(service.findAll('p1', STRANGER)).rejects.toMatchObject({
        error: expect.objectContaining({ statusCode: 403 }),
      });
      expect(repository.find).not.toHaveBeenCalled();
    });

    it('cannot decide one, and nothing is applied', async () => {
      const { service, repository, executor } = serviceWith();

      await expect(
        service.review({ id: 'c1', status: 'APPROVED' }, STRANGER, STRANGER)
      ).rejects.toMatchObject({
        error: expect.objectContaining({ statusCode: 403 }),
      });
      expect(executor.apply).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('cannot file one against it either', async () => {
      const { service, repository } = serviceWith();

      await expect(
        service.create(
          {
            projectId: 'p1',
            proposedBy: STRANGER,
            operation: 'task.create',
            payload: {},
          },
          STRANGER
        )
      ).rejects.toMatchObject({
        error: expect.objectContaining({ statusCode: 403 }),
      });
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('the owner', () => {
    it('can list and decide', async () => {
      const { service, executor } = serviceWith();

      await expect(service.findAll('p1', OWNER)).resolves.toEqual([]);
      await service.review({ id: 'c1', status: 'APPROVED' }, OWNER, OWNER);

      expect(executor.apply).toHaveBeenCalled();
    });
  });

  it('reports a second decision as a conflict rather than a server fault', async () => {
    // Two reviewers with the panel open both press approve. That is a race,
    // not a fault, and a bare Error reached the browser as a 500 that read as
    // "the assistant is broken".
    const { service } = serviceWith({
      id: 'c1',
      projectId: 'p1',
      status: 'APPROVED',
      operation: 'task.create',
      payload: {},
    });

    await expect(
      service.review({ id: 'c1', status: 'APPROVED' }, OWNER, OWNER)
    ).rejects.toMatchObject({
      error: expect.objectContaining({ statusCode: 409 }),
    });
  });

  it('leaves internal callers unscoped, as every other command does', async () => {
    // No requestingUserId means the gateway is not involved: seeds and the
    // MCP tools call in directly and are already trusted.
    const { service, repository } = serviceWith();

    await service.findAll('p1');

    expect(repository.find).toHaveBeenCalled();
  });
});
