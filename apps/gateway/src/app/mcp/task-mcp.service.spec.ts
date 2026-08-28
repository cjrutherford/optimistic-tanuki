import { of } from 'rxjs';
import { ProjectCommands, TaskCommands } from '@optimistic-tanuki/constants';
import { TaskPriority, TaskStatus } from '@optimistic-tanuki/models';
import { TaskMcpService } from './task-mcp.service';

describe('TaskMcpService', () => {
  let service: TaskMcpService;
  let clientProxy: any;

  const profileId = 'profile-456';
  const authenticatedRequest = { user: { profileId, userId: 'user-1' } };
  const unauthenticatedRequest = { user: undefined };

  beforeEach(() => {
    clientProxy = {
      send: jest.fn().mockReturnValue(of([])),
    };
    service = new TaskMcpService(clientProxy);
  });

  describe('list_tasks', () => {
    it('forwards requestingUserId derived from the authenticated request', async () => {
      await service.listTasks(
        { projectId: 'proj-1' },
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: TaskCommands.FIND_ALL },
        { projectId: 'proj-1', requestingUserId: profileId }
      );
    });

    it('throws without calling the microservice when unauthenticated', async () => {
      await expect(
        service.listTasks(
          { projectId: 'proj-1' },
          undefined,
          unauthenticatedRequest
        )
      ).rejects.toThrow(/Failed to list tasks/);
      expect(clientProxy.send).not.toHaveBeenCalled();
    });
  });

  describe('get_task', () => {
    it('sends { id, requestingUserId } matching the REST FIND_ONE shape', async () => {
      clientProxy.send.mockReturnValue(of({ id: 'task-1' }));

      await service.getTask(
        { taskId: 'task-1' },
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: TaskCommands.FIND_ONE },
        { id: 'task-1', requestingUserId: profileId }
      );
    });

    it('throws without calling the microservice when unauthenticated', async () => {
      await expect(
        service.getTask({ taskId: 'task-1' }, undefined, unauthenticatedRequest)
      ).rejects.toThrow(/Failed to get task/);
      expect(clientProxy.send).not.toHaveBeenCalled();
    });
  });

  describe('create_task', () => {
    it('derives createdBy from the authenticated profileId and forwards requestingUserId', async () => {
      clientProxy.send.mockReturnValue(of({ id: 'new-task' }));

      await service.createTask(
        {
          title: 'Do the thing',
          description: 'details',
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          projectId: 'proj-1',
        },
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: TaskCommands.CREATE },
        expect.objectContaining({
          createdBy: profileId,
          requestingUserId: profileId,
          projectId: 'proj-1',
        })
      );
    });

    it('throws without calling the microservice when unauthenticated', async () => {
      await expect(
        service.createTask(
          {
            title: 'Do the thing',
            description: 'details',
            status: TaskStatus.TODO,
            priority: TaskPriority.MEDIUM,
            projectId: 'proj-1',
          },
          undefined,
          unauthenticatedRequest
        )
      ).rejects.toThrow(/Failed to create task/);
      expect(clientProxy.send).not.toHaveBeenCalled();
    });
  });

  describe('update_task', () => {
    it('sends id + updatedBy + requestingUserId', async () => {
      clientProxy.send.mockReturnValue(of({ id: 'task-1' }));

      await service.updateTask(
        { id: 'task-1', title: 'Renamed' },
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: TaskCommands.UPDATE },
        expect.objectContaining({
          id: 'task-1',
          title: 'Renamed',
          updatedBy: profileId,
          requestingUserId: profileId,
        })
      );
    });
  });

  describe('delete_task', () => {
    it('sends { id, requestingUserId } to DELETE (matching the microservice handler)', async () => {
      clientProxy.send.mockReturnValue(of(undefined));

      await service.deleteTask(
        { taskId: 'task-1' },
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: TaskCommands.DELETE },
        { id: 'task-1', requestingUserId: profileId }
      );
    });

    it('throws without calling the microservice when unauthenticated', async () => {
      await expect(
        service.deleteTask(
          { taskId: 'task-1' },
          undefined,
          unauthenticatedRequest
        )
      ).rejects.toThrow(/Failed to delete task/);
      expect(clientProxy.send).not.toHaveBeenCalled();
    });
  });

  describe('query_tasks', () => {
    it('forwards requestingUserId derived from the authenticated request', async () => {
      await service.queryTasks(
        { projectId: 'proj-1', title: 'thing' },
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: TaskCommands.FIND_ALL },
        { projectId: 'proj-1', title: 'thing', requestingUserId: profileId }
      );
    });

    it('throws without calling the microservice when unauthenticated', async () => {
      await expect(
        service.queryTasks(
          { projectId: 'proj-1' },
          undefined,
          unauthenticatedRequest
        )
      ).rejects.toThrow(/Failed to query tasks/);
      expect(clientProxy.send).not.toHaveBeenCalled();
    });
  });

  /**
   * The gate that makes requireHumanApproval mean something.
   *
   * The flag was written when a project was created and read by nothing. This
   * is the path an agent uses to create work, so enforcing it anywhere else
   * would leave the agent free to act directly, which is what it did.
   */
  describe('create_task when the project requires approval', () => {
    function respondPerCommand(project: Record<string, unknown>) {
      clientProxy.send.mockImplementation((pattern: { cmd: string }) => {
        if (pattern.cmd === ProjectCommands.FIND_ONE) return of(project);
        if (pattern.cmd === ProjectCommands.CREATE_AI_CHANGE)
          return of({ id: 'proposal-1', status: 'PENDING' });
        return of({ id: 'new-task' });
      });
    }

    const args = {
      title: 'Do the thing',
      description: 'details',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      projectId: 'proj-1',
    };

    it('proposes instead of creating', async () => {
      respondPerCommand({ id: 'proj-1', requireHumanApproval: true });

      const result = await service.createTask(
        args,
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: ProjectCommands.CREATE_AI_CHANGE },
        expect.objectContaining({
          projectId: 'proj-1',
          operation: 'task.create',
          proposedBy: profileId,
        })
      );
      expect(clientProxy.send).not.toHaveBeenCalledWith(
        { cmd: TaskCommands.CREATE },
        expect.anything()
      );
      expect(result.awaitingApproval).toBe(true);
    });

    it('says the task was not created, in words an agent will repeat', async () => {
      // An agent told "created successfully" tells the person the same, and
      // nothing was created.
      respondPerCommand({ id: 'proj-1', requireHumanApproval: true });

      const result = await service.createTask(
        args,
        undefined,
        authenticatedRequest
      );

      expect(result.message).toMatch(/waiting for approval/i);
      expect(result.message).toMatch(/not been created/i);
    });

    it('creates directly when the project does not require approval', async () => {
      respondPerCommand({ id: 'proj-1', requireHumanApproval: false });

      const result = await service.createTask(
        args,
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: TaskCommands.CREATE },
        expect.objectContaining({ projectId: 'proj-1' })
      );
      expect(result.awaitingApproval).toBe(false);
    });
  });

  /**
   * The same gate on the other two ways an agent can change a board.
   *
   * Gating only creation would leave an agent able to rewrite or delete
   * whatever it liked on a project whose whole point is that a person decides.
   */
  describe('update_task and delete_task when the project requires approval', () => {
    function respondPerCommand(
      project: Record<string, unknown>,
      task: Record<string, unknown> = { id: 'task-1', projectId: 'proj-1' }
    ) {
      clientProxy.send.mockImplementation((pattern: { cmd: string }) => {
        if (pattern.cmd === ProjectCommands.FIND_ONE) return of(project);
        if (pattern.cmd === TaskCommands.FIND_ONE) return of(task);
        if (pattern.cmd === ProjectCommands.CREATE_AI_CHANGE)
          return of({ id: 'proposal-1', status: 'PENDING' });
        return of({ id: 'task-1' });
      });
    }

    it('proposes an update instead of making it', async () => {
      respondPerCommand({ id: 'proj-1', requireHumanApproval: true });

      const result = await service.updateTask(
        { id: 'task-1', title: 'Renamed' },
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: ProjectCommands.CREATE_AI_CHANGE },
        expect.objectContaining({ operation: 'task.update' })
      );
      expect(clientProxy.send).not.toHaveBeenCalledWith(
        { cmd: TaskCommands.UPDATE },
        expect.anything()
      );
      expect(result.awaitingApproval).toBe(true);
      expect(result.message).toMatch(/not been changed/i);
    });

    it('finds the project from the task when the caller did not name one', async () => {
      // projectId is optional on this tool. An update to a gated project must
      // not slip through because the argument was left out.
      respondPerCommand({ id: 'proj-1', requireHumanApproval: true });

      await service.updateTask(
        { id: 'task-1', status: TaskStatus.DONE },
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: ProjectCommands.FIND_ONE },
        expect.objectContaining({ id: 'proj-1' })
      );
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: ProjectCommands.CREATE_AI_CHANGE },
        expect.anything()
      );
    });

    it('updates directly when the project does not require approval', async () => {
      respondPerCommand({ id: 'proj-1', requireHumanApproval: false });

      const result = await service.updateTask(
        { id: 'task-1', title: 'Renamed' },
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: TaskCommands.UPDATE },
        expect.objectContaining({ title: 'Renamed' })
      );
      expect(result.awaitingApproval).toBeFalsy();
    });

    it('refuses to delete rather than deleting unreviewed', async () => {
      // Deletion cannot be proposed, so leaving it open would make the one
      // operation nobody can review also the only irreversible one.
      respondPerCommand({ id: 'proj-1', requireHumanApproval: true });

      const result = await service.deleteTask(
        { taskId: 'task-1' },
        undefined,
        authenticatedRequest
      );

      expect(result.success).toBe(false);
      expect(clientProxy.send).not.toHaveBeenCalledWith(
        { cmd: TaskCommands.DELETE },
        expect.anything()
      );
    });

    it('deletes when the project does not require approval', async () => {
      respondPerCommand({ id: 'proj-1', requireHumanApproval: false });

      const result = await service.deleteTask(
        { taskId: 'task-1' },
        undefined,
        authenticatedRequest
      );

      expect(result.success).toBe(true);
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: TaskCommands.DELETE },
        { id: 'task-1', requestingUserId: profileId }
      );
    });
  });
});
