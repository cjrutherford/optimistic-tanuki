import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ServiceTokens, WorkspaceCommands } from '@optimistic-tanuki/constants';
import { of } from 'rxjs';
import { WorkspaceResolverService } from './workspace-resolver.service';

describe('WorkspaceResolverService', () => {
  it('asks the Workspace service for an active canonical identity', async () => {
    const client = {
      send: jest.fn().mockReturnValue(
        of({
          workspaceId: 'workspace-1',
          kind: 'business-site',
          slug: 'north-star-coaching',
          displayName: 'North Star Coaching',
          appScope: 'business-site',
          ownerUserId: 'user-1',
          ownerProfileId: 'profile-1',
          status: 'active',
          source: { service: 'store', sourceId: 'site-config-1' },
        })
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    const resolver = new WorkspaceResolverService(client);

    await expect(
      resolver.resolveActive('business-site', 'north-star-coaching')
    ).resolves.toEqual(expect.objectContaining({ workspaceId: 'workspace-1' }));

    expect(client.send).toHaveBeenCalledWith(WorkspaceCommands.RESOLVE, {
      kind: 'business-site',
      slug: 'north-star-coaching',
      requireActive: true,
    });
  });

  it('does not accept malformed upstream identities as workspace context', async () => {
    const client = {
      send: jest.fn().mockReturnValue(of({ workspaceId: 'workspace-1' })),
    } as unknown as jest.Mocked<ClientProxy>;
    const resolver = new WorkspaceResolverService(client);

    await expect(
      resolver.resolveActive('business-site', 'north-star-coaching')
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('builds a child scope only when the resolved workspace belongs to the requested product scope', async () => {
    const client = {
      send: jest.fn().mockReturnValue(
        of({
          workspaceId: '123e4567-e89b-12d3-a456-426614174000',
          kind: 'business-site',
          slug: 'north-star-coaching',
          displayName: 'North Star',
          appScope: 'business-site',
          ownerUserId: 'user-1',
          ownerProfileId: 'profile-1',
          status: 'active',
          source: { service: 'store', sourceId: 'site-config-1' },
        })
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    const resolver = new WorkspaceResolverService(client);

    await expect(
      resolver.resolveContext(
        'business-site',
        'business-site',
        'north-star-coaching'
      )
    ).resolves.toEqual(
      expect.objectContaining({
        workspaceScope: 'workspace:123e4567-e89b-12d3-a456-426614174000',
      })
    );
    await expect(
      resolver.resolveContext('social', 'business-site', 'north-star-coaching')
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
