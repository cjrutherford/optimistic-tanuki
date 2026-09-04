import { of, throwError } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { RiskCommands } from '@optimistic-tanuki/constants';
import {
  RiskImpact,
  RiskLikelihood,
  RiskStatus,
} from '@optimistic-tanuki/models';
import { RiskMcpService } from './risk-mcp.service';

/**
 * Exercises every MCP risk tool: the identity it derives from the raw Express
 * request, the payload shape it sends to project-planning, the result it maps
 * back, and how a downstream failure surfaces.
 */
describe('RiskMcpService tools', () => {
  let service: RiskMcpService;
  let projectPlanning: { send: jest.Mock };

  const profileId = 'profile-42';
  const authed = { user: { profileId, userId: 'user-1' } };
  const anonymous = { user: undefined };

  const lastPattern = () => projectPlanning.send.mock.calls.at(-1)?.[0];
  const lastPayload = () => projectPlanning.send.mock.calls.at(-1)?.[1];

  beforeEach(() => {
    projectPlanning = { send: jest.fn().mockReturnValue(of([])) };
    service = new RiskMcpService(projectPlanning as unknown as ClientProxy);

    // Silence the per-instance logger rather than the console.
    (
      service as unknown as { logger: { log: jest.Mock; error: jest.Mock } }
    ).logger = { log: jest.fn(), error: jest.fn() } as never;
  });

  describe('list_risks', () => {
    it('sends the project id plus the request-derived requestingUserId', async () => {
      const risks = [{ id: 'risk-1' }, { id: 'risk-2' }];
      projectPlanning.send.mockReturnValue(of(risks));

      const result = await service.listRisks(
        { projectId: 'proj-1' },
        undefined,
        authed
      );

      expect(lastPattern()).toEqual({ cmd: RiskCommands.FIND_ALL });
      expect(lastPayload()).toEqual({
        projectId: 'proj-1',
        requestingUserId: profileId,
      });
      expect(result).toEqual({ success: true, risks, count: 2 });
    });

    it('refuses an unauthenticated call before touching the microservice', async () => {
      await expect(
        service.listRisks({ projectId: 'proj-1' }, undefined, anonymous)
      ).rejects.toThrow('Failed to list risks: Unauthenticated MCP call');
      expect(projectPlanning.send).not.toHaveBeenCalled();
    });

    it('wraps a downstream failure in a tool-level error', async () => {
      projectPlanning.send.mockReturnValue(
        throwError(() => new Error('downstream'))
      );

      await expect(
        service.listRisks({ projectId: 'proj-1' }, undefined, authed)
      ).rejects.toThrow('Failed to list risks: downstream');
    });
  });

  describe('create_risk', () => {
    it('defaults impact/likelihood/status and owns the risk with the caller profile', async () => {
      projectPlanning.send.mockReturnValue(of({ id: 'risk-1' }));

      const result = await service.createRisk(
        { projectId: 'proj-1', name: 'Vendor delay' },
        undefined,
        authed
      );

      expect(lastPattern()).toEqual({ cmd: RiskCommands.CREATE });
      expect(lastPayload()).toEqual({
        projectId: 'proj-1',
        name: 'Vendor delay',
        // With no description supplied the name doubles as the description.
        description: 'Vendor delay',
        riskOwner: profileId,
        impact: RiskImpact.LOW,
        likelihood: RiskLikelihood.UNLIKELY,
        status: RiskStatus.OPEN,
        requestingUserId: profileId,
      });
      expect(result).toEqual({
        success: true,
        message: 'Risk "Vendor delay" created successfully',
        risk: { id: 'risk-1' },
      });
    });

    it('prefixes a supplied description with the risk name and keeps explicit enums', async () => {
      projectPlanning.send.mockReturnValue(of({ id: 'risk-2' }));

      await service.createRisk(
        {
          projectId: 'proj-1',
          name: 'Key person',
          description: 'only one engineer knows the payments code',
          impact: RiskImpact.HIGH,
          likelihood: RiskLikelihood.LIKELY,
          status: RiskStatus.IN_PROGRESS,
        },
        undefined,
        authed
      );

      expect(lastPayload()).toEqual({
        projectId: 'proj-1',
        name: 'Key person',
        description: 'Key person: only one engineer knows the payments code',
        riskOwner: profileId,
        impact: RiskImpact.HIGH,
        likelihood: RiskLikelihood.LIKELY,
        status: RiskStatus.IN_PROGRESS,
        requestingUserId: profileId,
      });
    });

    it('refuses an unauthenticated call before touching the microservice', async () => {
      await expect(
        service.createRisk(
          { projectId: 'proj-1', name: 'Vendor delay' },
          undefined,
          anonymous
        )
      ).rejects.toThrow('Failed to create risk: Unauthenticated MCP call');
      expect(projectPlanning.send).not.toHaveBeenCalled();
    });

    it('wraps a downstream failure in a tool-level error', async () => {
      projectPlanning.send.mockReturnValue(
        throwError(() => new Error('downstream'))
      );

      await expect(
        service.createRisk(
          { projectId: 'proj-1', name: 'Vendor delay' },
          undefined,
          authed
        )
      ).rejects.toThrow('Failed to create risk: downstream');
    });
  });

  describe('update_risk', () => {
    it('sends only the fields that were supplied', async () => {
      projectPlanning.send.mockReturnValue(of({ id: 'risk-1' }));

      const result = await service.updateRisk(
        { riskId: 'risk-1', status: RiskStatus.CLOSED },
        undefined,
        authed
      );

      expect(lastPattern()).toEqual({ cmd: RiskCommands.UPDATE });
      expect(lastPayload()).toEqual({
        id: 'risk-1',
        updatedBy: profileId,
        requestingUserId: profileId,
        status: RiskStatus.CLOSED,
      });
      expect(result).toEqual({
        success: true,
        message: 'Risk updated successfully',
        risk: { id: 'risk-1' },
      });
    });

    it('carries every optional field through when all are supplied', async () => {
      projectPlanning.send.mockReturnValue(of({ id: 'risk-1' }));

      await service.updateRisk(
        {
          riskId: 'risk-1',
          name: 'Renamed',
          description: 'new description',
          impact: RiskImpact.MEDIUM,
          likelihood: RiskLikelihood.POSSIBLE,
          status: RiskStatus.OPEN,
        },
        undefined,
        authed
      );

      expect(lastPayload()).toEqual({
        id: 'risk-1',
        updatedBy: profileId,
        requestingUserId: profileId,
        name: 'Renamed',
        description: 'new description',
        impact: RiskImpact.MEDIUM,
        likelihood: RiskLikelihood.POSSIBLE,
        status: RiskStatus.OPEN,
      });
    });

    it('refuses an unauthenticated call before touching the microservice', async () => {
      await expect(
        service.updateRisk({ riskId: 'risk-1' }, undefined, anonymous)
      ).rejects.toThrow('Failed to update risk: Unauthenticated MCP call');
      expect(projectPlanning.send).not.toHaveBeenCalled();
    });

    it('wraps a downstream failure in a tool-level error', async () => {
      projectPlanning.send.mockReturnValue(
        throwError(() => new Error('downstream'))
      );

      await expect(
        service.updateRisk({ riskId: 'risk-1' }, undefined, authed)
      ).rejects.toThrow('Failed to update risk: downstream');
    });
  });

  describe('delete_risk', () => {
    it('sends the risk id and the caller profile, and reports success', async () => {
      projectPlanning.send.mockReturnValue(of(undefined));

      const result = await service.deleteRisk(
        { riskId: 'risk-1' },
        undefined,
        authed
      );

      expect(lastPattern()).toEqual({ cmd: RiskCommands.REMOVE });
      expect(lastPayload()).toEqual({
        id: 'risk-1',
        requestingUserId: profileId,
      });
      expect(result).toEqual({
        success: true,
        message: 'Risk deleted successfully',
      });
    });

    it('refuses an unauthenticated call before touching the microservice', async () => {
      await expect(
        service.deleteRisk({ riskId: 'risk-1' }, undefined, anonymous)
      ).rejects.toThrow('Failed to delete risk: Unauthenticated MCP call');
      expect(projectPlanning.send).not.toHaveBeenCalled();
    });

    it('wraps a downstream failure in a tool-level error', async () => {
      projectPlanning.send.mockReturnValue(
        throwError(() => new Error('downstream'))
      );

      await expect(
        service.deleteRisk({ riskId: 'risk-1' }, undefined, authed)
      ).rejects.toThrow('Failed to delete risk: downstream');
    });
  });

  describe('query_risks', () => {
    it('spreads the whole query alongside the caller profile onto FIND_ALL', async () => {
      const risks = [{ id: 'risk-1' }];
      projectPlanning.send.mockReturnValue(of(risks));

      const result = await service.queryRisks(
        {
          projectId: 'proj-1',
          name: 'vendor',
          impact: RiskImpact.HIGH,
          status: RiskStatus.OPEN,
        },
        undefined,
        authed
      );

      expect(lastPattern()).toEqual({ cmd: RiskCommands.FIND_ALL });
      expect(lastPayload()).toEqual({
        projectId: 'proj-1',
        name: 'vendor',
        impact: RiskImpact.HIGH,
        status: RiskStatus.OPEN,
        requestingUserId: profileId,
      });
      expect(result).toEqual({ success: true, risks, count: 1 });
    });

    it('refuses an unauthenticated call before touching the microservice', async () => {
      await expect(
        service.queryRisks({ projectId: 'proj-1' }, undefined, anonymous)
      ).rejects.toThrow('Failed to query risks: Unauthenticated MCP call');
      expect(projectPlanning.send).not.toHaveBeenCalled();
    });

    it('wraps a downstream failure in a tool-level error', async () => {
      projectPlanning.send.mockReturnValue(
        throwError(() => new Error('downstream'))
      );

      await expect(
        service.queryRisks({ projectId: 'proj-1' }, undefined, authed)
      ).rejects.toThrow('Failed to query risks: downstream');
    });
  });

  describe('identity handling', () => {
    it('rejects a request whose user carries no profileId', async () => {
      await expect(
        service.listRisks({ projectId: 'proj-1' }, undefined, {
          user: { userId: 'user-1' },
        })
      ).rejects.toThrow('Failed to list risks: Unauthenticated MCP call');
    });

    it('rejects a call made with no request object at all', async () => {
      await expect(
        service.listRisks({ projectId: 'proj-1' }, undefined, undefined)
      ).rejects.toThrow('Failed to list risks: Unauthenticated MCP call');
    });

    it('never lets a tool argument override the request-derived identity', async () => {
      projectPlanning.send.mockReturnValue(of([]));

      await service.queryRisks(
        {
          projectId: 'proj-1',
          // A malicious client can put anything in the tool arguments; the
          // spread happens before requestingUserId, so identity still wins.
          requestingUserId: 'someone-else',
        } as never,
        undefined,
        authed
      );

      expect(lastPayload().requestingUserId).toBe(profileId);
    });
  });
});
