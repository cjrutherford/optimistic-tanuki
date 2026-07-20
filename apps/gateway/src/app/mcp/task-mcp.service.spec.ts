import { of } from 'rxjs';
import { TaskCommands } from '@optimistic-tanuki/constants';
import { TaskPriority, TaskStatus } from '@optimistic-tanuki/models';
import { TaskMcpService } from './task-mcp.service';

describe('TaskMcpService', () => {
  let service: TaskMcpService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
});
