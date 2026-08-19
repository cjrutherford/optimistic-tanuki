import { ConflictException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AppScopeCommands,
  CommunityCommands,
  RoleCommands,
  TrainerConfigCommands,
  WorkspaceCommands,
} from '@optimistic-tanuki/constants';
import { of } from 'rxjs';
import { WorkspaceClaimController } from './workspace-claim.controller';

describe('WorkspaceClaimController', () => {
  const user = {
    userId: 'user-1',
    profileId: 'profile-1',
    email: 'owner@example.com',
    emailVerified: true,
  } as any;

  const createPermissionsClient = () =>
    ({
      send: jest
        .fn()
        .mockReturnValueOnce(of(null))
        .mockReturnValueOnce(of({ id: 'workspace-scope-1' }))
        .mockReturnValueOnce(of({ id: 'owner-role-1' }))
        .mockReturnValueOnce(of({ id: 'assignment-1' })),
    } as unknown as jest.Mocked<ClientProxy>);

  it('derives business workspace identity from the verified owner config and activates it', async () => {
    const storeClient = {
      send: jest.fn().mockReturnValue(
        of({
          id: 'config-1',
          config: {
            leadContext: { profileId: 'profile-1', appScope: 'business-site' },
            brand: { businessName: 'North Star Coaching' },
          },
        })
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    const workspaceClient = {
      send: jest
        .fn()
        .mockReturnValue(
          of({
            workspaceId: '123e4567-e89b-12d3-a456-426614174000',
            status: 'active',
          })
        ),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new WorkspaceClaimController(
      storeClient,
      workspaceClient,
      {} as ClientProxy,
      createPermissionsClient()
    );

    await expect(
      controller.claimBusinessSite(
        { slug: 'north-star-coaching' },
        user,
        'business-site'
      )
    ).resolves.toEqual({
      workspace: {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'active',
      },
      returnPath: '/owner/site',
    });

    expect(storeClient.send).toHaveBeenCalledWith(
      TrainerConfigCommands.GET_CONFIG,
      {
        configKey: 'default',
        slug: 'north-star-coaching',
      }
    );
    expect(workspaceClient.send).toHaveBeenNthCalledWith(
      1,
      WorkspaceCommands.REGISTER,
      {
        kind: 'business-site',
        slug: 'north-star-coaching',
        displayName: 'North Star Coaching',
        appScope: 'business-site',
        ownerUserId: 'user-1',
        ownerProfileId: 'profile-1',
        source: { service: 'store', sourceId: 'config-1' },
      }
    );
    expect(workspaceClient.send).toHaveBeenNthCalledWith(
      2,
      WorkspaceCommands.ACTIVATE,
      {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        source: { service: 'store', sourceId: 'config-1' },
      }
    );
  });

  it('provisions the canonical child permission scope after activating a business workspace', async () => {
    const workspaceId = '123e4567-e89b-12d3-a456-426614174000';
    const storeClient = {
      send: jest.fn().mockReturnValue(
        of({
          id: 'config-1',
          config: { leadContext: { profileId: 'profile-1' } },
        })
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    const workspaceClient = {
      send: jest.fn().mockReturnValue(of({ workspaceId, status: 'active' })),
    } as unknown as jest.Mocked<ClientProxy>;
    const permissionsClient = {
      send: jest
        .fn()
        .mockReturnValueOnce(of(null))
        .mockReturnValueOnce(of({ id: 'child-scope-id' }))
        .mockReturnValueOnce(of({ id: 'owner-role-1' }))
        .mockReturnValueOnce(of({ id: 'assignment-1' })),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new WorkspaceClaimController(
      storeClient,
      workspaceClient,
      {} as ClientProxy,
      permissionsClient
    );

    await controller.claimBusinessSite(
      { slug: 'north-star-coaching' },
      user,
      'business-site'
    );

    expect(permissionsClient.send).toHaveBeenNthCalledWith(
      1,
      { cmd: AppScopeCommands.GetByName },
      { name: `workspace:${workspaceId}` }
    );
    expect(permissionsClient.send).toHaveBeenNthCalledWith(
      2,
      { cmd: AppScopeCommands.Create },
      {
        name: `workspace:${workspaceId}`,
        description: 'Business site workspace permission scope',
        active: true,
      }
    );
    expect(permissionsClient.send).toHaveBeenNthCalledWith(
      3,
      { cmd: RoleCommands.GetByName },
      { name: 'business_site_owner', appScope: 'business-site' }
    );
    expect(permissionsClient.send).toHaveBeenNthCalledWith(
      4,
      { cmd: RoleCommands.Assign },
      {
        roleId: 'owner-role-1',
        profileId: 'profile-1',
        appScopeId: 'child-scope-id',
      }
    );
  });

  it('does not let an authenticated owner claim another profile’s business config', async () => {
    const storeClient = {
      send: jest.fn().mockReturnValue(
        of({
          id: 'config-1',
          config: { leadContext: { profileId: 'profile-2' } },
        })
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    const workspaceClient = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new WorkspaceClaimController(
      storeClient,
      workspaceClient,
      {} as ClientProxy,
      createPermissionsClient()
    );

    await expect(
      controller.claimBusinessSite(
        { slug: 'north-star-coaching' },
        user,
        'business-site'
      )
    ).rejects.toBeInstanceOf(ConflictException);
    expect(workspaceClient.send).not.toHaveBeenCalled();
  });

  it('rejects a claim before any source lookup when the authenticated email is unverified', async () => {
    const storeClient = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;
    const workspaceClient = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new WorkspaceClaimController(
      storeClient,
      workspaceClient,
      {} as ClientProxy,
      createPermissionsClient()
    );

    await expect(
      controller.claimBusinessSite(
        { slug: 'north-star-coaching' },
        { ...user, emailVerified: false },
        'business-site'
      )
    ).rejects.toThrow('Email verification is required');
    expect(storeClient.send).not.toHaveBeenCalled();
  });

  it('returns only a safe local return intent after a successful claim', async () => {
    const storeClient = {
      send: jest.fn().mockReturnValue(
        of({
          id: 'config-1',
          config: {
            leadContext: { profileId: 'profile-1' },
            brand: { businessName: 'North Star Coaching' },
          },
        })
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    const workspaceClient = {
      send: jest
        .fn()
        .mockReturnValue(
          of({
            workspaceId: '123e4567-e89b-12d3-a456-426614174000',
            status: 'active',
          })
        ),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new WorkspaceClaimController(
      storeClient,
      workspaceClient,
      {} as ClientProxy,
      createPermissionsClient()
    );

    await expect(
      controller.claimBusinessSite(
        { slug: 'north-star-coaching', returnPath: '//attacker.example' },
        user,
        'business-site'
      )
    ).resolves.toEqual({
      workspace: {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'active',
      },
      returnPath: '/owner/site',
    });
  });

  it('leaves activation repairable through the same idempotent claim request', async () => {
    const storeClient = {
      send: jest.fn().mockReturnValue(
        of({
          id: 'config-1',
          config: { leadContext: { profileId: 'profile-1' } },
        })
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    const workspaceClient = {
      send: jest
        .fn()
        .mockReturnValueOnce(
          of({
            workspaceId: '123e4567-e89b-12d3-a456-426614174000',
            status: 'draft',
          })
        )
        .mockReturnValueOnce({
          subscribe: () => {
            throw new Error('activation unavailable');
          },
        })
        .mockReturnValueOnce(
          of({
            workspaceId: '123e4567-e89b-12d3-a456-426614174000',
            status: 'draft',
          })
        )
        .mockReturnValueOnce(
          of({
            workspaceId: '123e4567-e89b-12d3-a456-426614174000',
            status: 'active',
          })
        ),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new WorkspaceClaimController(
      storeClient,
      workspaceClient,
      {} as ClientProxy,
      createPermissionsClient()
    );

    await expect(
      controller.claimBusinessSite(
        { slug: 'north-star-coaching' },
        user,
        'business-site'
      )
    ).rejects.toThrow('activation unavailable');
    await expect(
      controller.claimBusinessSite(
        { slug: 'north-star-coaching' },
        user,
        'business-site'
      )
    ).resolves.toEqual({
      workspace: {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'active',
      },
      returnPath: '/owner/site',
    });
  });

  it('derives community identity from the verified community owner and activates it', async () => {
    const socialClient = {
      send: jest.fn().mockReturnValue(
        of({
          id: 'community-1',
          name: 'North Star Community',
          slug: 'north-star',
          ownerId: 'user-1',
          ownerProfileId: 'profile-1',
          appScope: 'social',
        })
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    const workspaceClient = {
      send: jest
        .fn()
        .mockReturnValue(
          of({
            workspaceId: '123e4567-e89b-12d3-a456-426614174001',
            status: 'active',
          })
        ),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new WorkspaceClaimController(
      {} as ClientProxy,
      workspaceClient,
      socialClient,
      createPermissionsClient()
    );

    await expect(
      controller.claimCommunity({ slug: 'north-star' }, user, 'social')
    ).resolves.toEqual({
      workspace: {
        workspaceId: '123e4567-e89b-12d3-a456-426614174001',
        status: 'active',
      },
      returnPath: '/communities/north-star',
    });

    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: CommunityCommands.FIND_BY_SLUG },
      { slug: 'north-star' }
    );
    expect(workspaceClient.send).toHaveBeenNthCalledWith(
      1,
      WorkspaceCommands.REGISTER,
      expect.objectContaining({
        kind: 'community',
        ownerUserId: 'user-1',
        ownerProfileId: 'profile-1',
        source: { service: 'social', sourceId: 'community-1' },
      })
    );
  });
});
