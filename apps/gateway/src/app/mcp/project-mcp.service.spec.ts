import { of } from 'rxjs';
import {
  ChangeCommands,
  ProjectCommands,
  ProjectJournalCommands,
  RiskCommands,
  TaskCommands,
} from '@optimistic-tanuki/constants';
import { ProjectMcpService } from './project-mcp.service';

describe('ProjectMcpService', () => {
  let service: ProjectMcpService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clientProxy: any;

  const profileId = 'profile-123';
  const authenticatedRequest = { user: { profileId, userId: 'user-1' } };
  const unauthenticatedRequest = { user: undefined };

  beforeEach(() => {
    clientProxy = {
      send: jest.fn().mockReturnValue(of([])),
    };
    service = new ProjectMcpService(clientProxy);
  });

  describe('list_projects', () => {
    it('forwards requestingUserId derived from the authenticated request', async () => {
      await service.listProjects({}, undefined, authenticatedRequest);

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: ProjectCommands.FIND_ALL },
        { requestingUserId: profileId }
      );
    });

    it('throws without calling the microservice when unauthenticated', async () => {
      await expect(
        service.listProjects({}, undefined, unauthenticatedRequest)
      ).rejects.toThrow(/Failed to list projects/);
      expect(clientProxy.send).not.toHaveBeenCalled();
    });
  });

  describe('get_project', () => {
    it('sends { id, requestingUserId } matching the REST FIND_ONE shape', async () => {
      clientProxy.send.mockReturnValue(of({ id: 'proj-1' }));

      await service.getProject(
        { projectId: 'proj-1' },
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: ProjectCommands.FIND_ONE },
        { id: 'proj-1', requestingUserId: profileId }
      );
    });

    it('throws without calling the microservice when unauthenticated', async () => {
      await expect(
        service.getProject(
          { projectId: 'proj-1' },
          undefined,
          unauthenticatedRequest
        )
      ).rejects.toThrow(/Failed to get project/);
      expect(clientProxy.send).not.toHaveBeenCalled();
    });
  });

  describe('create_project', () => {
    it('derives owner and createdBy from the authenticated profileId and forwards requestingUserId', async () => {
      clientProxy.send.mockReturnValue(of({ id: 'new-project' }));

      await service.createProject(
        {
          name: 'New Project',
          description: 'desc',
          status: 'PLANNING',
        },
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: ProjectCommands.CREATE },
        expect.objectContaining({
          owner: profileId,
          createdBy: profileId,
          requestingUserId: profileId,
        })
      );
    });

    it('throws without calling the microservice when unauthenticated', async () => {
      await expect(
        service.createProject(
          { name: 'x', description: 'y', status: 'PLANNING' },
          undefined,
          unauthenticatedRequest
        )
      ).rejects.toThrow(/Failed to create project/);
      expect(clientProxy.send).not.toHaveBeenCalled();
    });
  });

  describe('update_project', () => {
    it('sends id + updatedBy + requestingUserId', async () => {
      clientProxy.send.mockReturnValue(of({ id: 'proj-1' }));

      await service.updateProject(
        { projectId: 'proj-1', name: 'Renamed' },
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: ProjectCommands.UPDATE },
        expect.objectContaining({
          id: 'proj-1',
          name: 'Renamed',
          updatedBy: profileId,
          requestingUserId: profileId,
        })
      );
    });
  });

  describe('delete_project', () => {
    it('sends { id, requestingUserId } to REMOVE', async () => {
      clientProxy.send.mockReturnValue(of(undefined));

      await service.deleteProject(
        { projectId: 'proj-1' },
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: ProjectCommands.REMOVE },
        { id: 'proj-1', requestingUserId: profileId }
      );
    });
  });

  describe('query_projects', () => {
    it('forwards requestingUserId instead of any caller-supplied identity', async () => {
      await service.queryProjects(
        { name: 'Website' },
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: ProjectCommands.FIND_ALL },
        { name: 'Website', requestingUserId: profileId }
      );
    });
  });

  describe('getProjectContext resource', () => {
    it('reads user off request.raw.user and forwards requestingUserId on all five FIND payloads', async () => {
      const adaptedRequest = { raw: { user: { profileId } } };

      await service.getProjectContext(
        { projectId: 'proj-1' },
        undefined,
        adaptedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: ProjectCommands.FIND_ONE },
        { id: 'proj-1', requestingUserId: profileId }
      );
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: TaskCommands.FIND_ALL },
        { projectId: 'proj-1', requestingUserId: profileId }
      );
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: RiskCommands.FIND_ALL },
        { projectId: 'proj-1', requestingUserId: profileId }
      );
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: ChangeCommands.FIND_ALL },
        { projectId: 'proj-1', requestingUserId: profileId }
      );
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: ProjectJournalCommands.FIND_ALL },
        { projectId: 'proj-1', requestingUserId: profileId }
      );
    });

    it('falls back to request.user when request.raw is absent', async () => {
      await service.getProjectContext(
        { projectId: 'proj-1' },
        undefined,
        authenticatedRequest
      );

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: ProjectCommands.FIND_ONE },
        { id: 'proj-1', requestingUserId: profileId }
      );
    });

    it('throws without calling the microservice when unauthenticated', async () => {
      await expect(
        service.getProjectContext({ projectId: 'proj-1' }, undefined, {
          raw: {},
        })
      ).rejects.toThrow(/Failed to get project context/);
      expect(clientProxy.send).not.toHaveBeenCalled();
    });
  });
});
