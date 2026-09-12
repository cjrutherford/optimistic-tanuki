import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { WorkspaceCommands } from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';
import { WorkspaceDiscoveryController } from './workspace-discovery.controller';

describe('WorkspaceDiscoveryController', () => {
  const owner = {
    userId: 'owner-user-1',
    profileId: 'owner-profile-1',
  } as any;

  const workspace = {
    workspaceId: '123e4567-e89b-12d3-a456-426614174000',
    kind: 'business-site',
    slug: 'north-star-coaching',
    displayName: 'North Star Coaching',
    appScope: 'business-site',
    ownerUserId: owner.userId,
    ownerProfileId: owner.profileId,
    status: 'active',
    source: {
      service: 'store',
      sourceId: '123e4567-e89b-12d3-a456-426614174002',
    },
  };

  it('lists only canonical workspaces for the authenticated owner without exposing ownership internals', async () => {
    const workspaceClient = {
      send: jest.fn().mockReturnValue(of([workspace])),
    } as unknown as jest.Mocked<ClientProxy>;
    const appConfigClient = {
      send: jest.fn((command: { cmd: string }) =>
        command.cmd === 'app-config.resolveContext'
          ? of({
              ownerUserId: owner.userId,
              ownerProfileId: owner.profileId,
              workspaceId: workspace.workspaceId,
              appScope: workspace.appScope,
              appInstanceId: 'app-instance-1',
              membershipId: 'membership-1',
              membershipRole: 'owner',
              membershipStatus: 'active',
            })
          : of({
              id: 'configuration-1',
              workspaceId: workspace.workspaceId,
              appInstanceId: 'app-instance-1',
              appScope: workspace.appScope,
            })
      ),
    };
    const controller = new WorkspaceDiscoveryController(
      workspaceClient,
      appConfigClient as any
    );

    await expect(controller.list(owner)).resolves.toEqual([
      {
        workspaceId: workspace.workspaceId,
        kind: 'business-site',
        slug: 'north-star-coaching',
        displayName: 'North Star Coaching',
        appScope: 'business-site',
        status: 'active',
        appInstanceId: 'app-instance-1',
        configurationId: 'configuration-1',
        membershipRole: 'owner',
        membershipStatus: 'active',
      },
    ]);
    expect(workspaceClient.send).toHaveBeenCalledWith(
      WorkspaceCommands.LIST_OWNED,
      { ownerUserId: owner.userId, ownerProfileId: owner.profileId }
    );
  });

  it('uses the authenticated owner identity for direct lookup and preserves a foreign-workspace denial', async () => {
    const workspaceClient = {
      send: jest
        .fn()
        .mockReturnValue(
          throwError(() => new NotFoundException('Workspace was not found'))
        ),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new WorkspaceDiscoveryController(workspaceClient);

    await expect(
      controller.findOne('foreign-workspace-id', owner)
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(workspaceClient.send).toHaveBeenCalledWith(
      WorkspaceCommands.RESOLVE_OWNED,
      {
        workspaceId: 'foreign-workspace-id',
        ownerUserId: owner.userId,
        ownerProfileId: owner.profileId,
      }
    );
  });

  it('maps a serialized malformed-selector RPC error to HTTP 400', async () => {
    const workspaceClient = {
      send: jest.fn().mockReturnValue(
        throwError(() => ({
          statusCode: 400,
          message: 'Workspace ID must be a valid UUID',
        }))
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new WorkspaceDiscoveryController(workspaceClient);

    await expect(controller.findOne('p43-a', owner)).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({
        message: 'Workspace ID must be a valid UUID',
      }),
    });
    await expect(controller.findOne('p43-a', owner)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('maps a serialized foreign-workspace RPC error to HTTP 404', async () => {
    const workspaceClient = {
      send: jest.fn().mockReturnValue(
        throwError(() => ({
          statusCode: 404,
          message: 'Workspace was not found',
        }))
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new WorkspaceDiscoveryController(workspaceClient);

    await expect(
      controller.findOne('123e4567-e89b-12d3-a456-426614174001', owner)
    ).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({
        message: 'Workspace was not found',
      }),
    });
    await expect(
      controller.findOne('123e4567-e89b-12d3-a456-426614174001', owner)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns app identity and configuration only from an owner context resolved by app-configurator', async () => {
    const appConfigClient = {
      send: jest.fn((command: { cmd: string }) =>
        command.cmd === 'app-config.resolveContext'
          ? of({
              ownerUserId: owner.userId,
              ownerProfileId: owner.profileId,
              workspaceId: workspace.workspaceId,
              appScope: workspace.appScope,
              appInstanceId: 'app-instance-1',
              membershipId: 'membership-1',
              membershipRole: 'owner',
              membershipStatus: 'active',
            })
          : of({
              id: 'configuration-1',
              workspaceId: workspace.workspaceId,
              appInstanceId: 'app-instance-1',
              appScope: workspace.appScope,
            })
      ),
    };
    const workspaceClient = {
      send: jest.fn().mockReturnValue(of([workspace])),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new (WorkspaceDiscoveryController as any)(
      workspaceClient,
      appConfigClient
    ) as WorkspaceDiscoveryController;

    await expect(controller.list(owner)).resolves.toEqual([
      expect.objectContaining({
        workspaceId: workspace.workspaceId,
        appScope: workspace.appScope,
        appInstanceId: 'app-instance-1',
        configurationId: 'configuration-1',
        membershipRole: 'owner',
        membershipStatus: 'active',
      }),
    ]);
    expect(appConfigClient.send).toHaveBeenNthCalledWith(
      1,
      { cmd: 'app-config.resolveContext' },
      expect.objectContaining({
        ownerUserId: owner.userId,
        ownerProfileId: owner.profileId,
        workspaceId: workspace.workspaceId,
        appScope: workspace.appScope,
      })
    );
  });

  it.each([
    ['foreign app instance', { appInstanceId: 'other-app' }],
    ['foreign workspace', { workspaceId: 'other-workspace' }],
    ['wrong app scope', { appScope: 'other-scope' }],
    ['inactive membership', { membershipStatus: 'suspended' }],
    ['non-owner membership', { membershipRole: 'member' }],
  ])(
    'omits a workspace when the resolved app context is %s',
    async (_label, override) => {
      const appConfigClient = {
        send: jest.fn((command: { cmd: string }) =>
          command.cmd === 'app-config.resolveContext'
            ? of({
                ownerUserId: owner.userId,
                ownerProfileId: owner.profileId,
                workspaceId: workspace.workspaceId,
                appScope: workspace.appScope,
                appInstanceId: 'app-instance-1',
                membershipId: 'membership-1',
                membershipRole: 'owner',
                membershipStatus: 'active',
                ...override,
              })
            : of([])
        ),
      };
      const workspaceClient = {
        send: jest.fn().mockReturnValue(of([workspace])),
      } as unknown as jest.Mocked<ClientProxy>;
      const controller = new (WorkspaceDiscoveryController as any)(
        workspaceClient,
        appConfigClient
      ) as WorkspaceDiscoveryController;

      await expect(controller.list(owner)).resolves.toEqual([]);
    }
  );

  it('omits incomplete configuration context instead of returning a partially authoritative workspace', async () => {
    const appConfigClient = {
      send: jest.fn().mockReturnValue(
        of({
          ownerUserId: owner.userId,
          ownerProfileId: owner.profileId,
          workspaceId: workspace.workspaceId,
          appScope: workspace.appScope,
          appInstanceId: undefined,
          membershipId: 'membership-1',
          membershipRole: 'owner',
          membershipStatus: 'active',
        })
      ),
    };
    const workspaceClient = {
      send: jest.fn().mockReturnValue(of([workspace])),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new (WorkspaceDiscoveryController as any)(
      workspaceClient,
      appConfigClient
    ) as WorkspaceDiscoveryController;

    await expect(controller.list(owner)).resolves.toEqual([]);
  });

  it('uses one configuration-by-context lookup after resolving the authoritative context', async () => {
    const appConfigClient = {
      send: jest.fn((command: { cmd: string }) =>
        command.cmd === 'app-config.resolveContext'
          ? of({
              ownerUserId: owner.userId,
              ownerProfileId: owner.profileId,
              workspaceId: workspace.workspaceId,
              appScope: workspace.appScope,
              appInstanceId: 'app-instance-1',
              membershipId: 'membership-1',
              membershipRole: 'owner',
              membershipStatus: 'active',
            })
          : command.cmd === 'app-config.getByContext'
          ? of({
              id: 'configuration-1',
              workspaceId: workspace.workspaceId,
              appInstanceId: 'app-instance-1',
              appScope: workspace.appScope,
            })
          : of([])
      ),
    };
    const workspaceClient = {
      send: jest.fn().mockReturnValue(of([workspace])),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new WorkspaceDiscoveryController(
      workspaceClient,
      appConfigClient as any
    );

    await expect(controller.list(owner)).resolves.toHaveLength(1);
    expect(appConfigClient.send).toHaveBeenCalledWith(
      { cmd: 'app-config.getByContext' },
      expect.objectContaining({ context: expect.any(Object) })
    );
    expect(appConfigClient.send).not.toHaveBeenCalledWith(
      { cmd: 'app-config.getAll' },
      expect.anything()
    );
  });

  it('omits a configuration response whose identity does not match the resolved context', async () => {
    const appConfigClient = {
      send: jest.fn((command: { cmd: string }) =>
        command.cmd === 'app-config.resolveContext'
          ? of({
              ownerUserId: owner.userId,
              ownerProfileId: owner.profileId,
              workspaceId: workspace.workspaceId,
              appScope: workspace.appScope,
              appInstanceId: 'app-instance-1',
              membershipId: 'membership-1',
              membershipRole: 'owner',
              membershipStatus: 'active',
            })
          : of({
              id: 'configuration-1',
              workspaceId: 'foreign-workspace',
              appInstanceId: 'app-instance-1',
              appScope: workspace.appScope,
            })
      ),
    };
    const workspaceClient = {
      send: jest.fn().mockReturnValue(of([workspace])),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new WorkspaceDiscoveryController(
      workspaceClient,
      appConfigClient as any
    );

    await expect(controller.list(owner)).resolves.toEqual([]);
  });
});
