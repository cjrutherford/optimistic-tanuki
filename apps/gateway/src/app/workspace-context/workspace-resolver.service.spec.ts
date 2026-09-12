import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ServiceTokens, WorkspaceCommands } from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';
import { WorkspaceResolverService } from './workspace-resolver.service';

describe('WorkspaceResolverService', () => {
  it('asks the Workspace service for an active canonical identity', async () => {
    const client = {
      send: jest.fn().mockReturnValue(
        of({
          workspaceId: '123e4567-e89b-12d3-a456-426614174000',
          kind: 'business-site',
          slug: 'north-star-coaching',
          displayName: 'North Star Coaching',
          appScope: 'business-site',
          ownerUserId: 'user-1',
          ownerProfileId: 'profile-1',
          status: 'active',
          source: {
            service: 'store',
            sourceId: '123e4567-e89b-42d3-a456-426614174021',
          },
        })
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    const resolver = new WorkspaceResolverService(client);

    await expect(
      resolver.resolveActive(
        'business-site',
        'business-site',
        'north-star-coaching'
      )
    ).resolves.toEqual(
      expect.objectContaining({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      })
    );

    expect(client.send).toHaveBeenCalledWith(WorkspaceCommands.RESOLVE, {
      appScope: 'business-site',
      kind: 'business-site',
      slug: 'north-star-coaching',
      requireActive: true,
    });
  });

  it('does not accept malformed upstream identities as workspace context', async () => {
    const client = {
      send: jest
        .fn()
        .mockReturnValue(
          of({ workspaceId: '123e4567-e89b-12d3-a456-426614174000' })
        ),
    } as unknown as jest.Mocked<ClientProxy>;
    const resolver = new WorkspaceResolverService(client);

    await expect(
      resolver.resolveActive(
        'business-site',
        'business-site',
        'north-star-coaching'
      )
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('passes app scope as a separate source-resolution dimension', async () => {
    const client = {
      send: jest.fn().mockReturnValue(
        of({
          workspaceId: '123e4567-e89b-12d3-a456-426614174000',
          kind: 'community',
          slug: 'community-one',
          displayName: 'Community One',
          appScope: 'client-interface',
          ownerUserId: 'user-1',
          ownerProfileId: 'profile-1',
          status: 'active',
          source: {
            service: 'social',
            sourceId: '123e4567-e89b-42d3-a456-426614174022',
          },
        })
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    const resolver = new WorkspaceResolverService(client);

    await resolver.resolveContextBySource('client-interface', 'community', {
      service: 'social',
      sourceId: '123e4567-e89b-42d3-a456-426614174022',
    });

    expect(client.send).toHaveBeenCalledWith(
      WorkspaceCommands.RESOLVE_BY_SOURCE,
      {
        appScope: 'client-interface',
        source: {
          service: 'social',
          sourceId: '123e4567-e89b-42d3-a456-426614174022',
        },
        requireActive: true,
      }
    );
  });

  it('maps a workspace RPC bad-request selector error before app-config routes see it', async () => {
    const client = {
      send: jest.fn().mockReturnValue(
        throwError(() => ({
          statusCode: 400,
          message: 'Workspace ID must be a valid UUID',
        }))
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    const resolver = new WorkspaceResolverService(client);

    await expect(
      resolver.resolveActive('business-site', 'business-site', 'p43-a')
    ).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({
        message: 'Workspace ID must be a valid UUID',
      }),
    });
    await expect(
      resolver.resolveActive('business-site', 'business-site', 'p43-a')
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps a normal wrong-scope workspace RPC not-found to 404', async () => {
    const client = {
      send: jest.fn().mockReturnValue(
        throwError(() => ({
          statusCode: 404,
          message: 'Workspace was not found',
        }))
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    const resolver = new WorkspaceResolverService(client);

    await expect(
      resolver.resolveActive(
        'business-site',
        'business-site',
        'foreign-workspace'
      )
    ).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({
        message: 'Workspace was not found',
      }),
    });
    await expect(
      resolver.resolveActive(
        'business-site',
        'business-site',
        'foreign-workspace'
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 403 for a defensive inconsistent-upstream app-scope mismatch', async () => {
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
          source: {
            service: 'store',
            sourceId: '123e4567-e89b-42d3-a456-426614174021',
          },
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
