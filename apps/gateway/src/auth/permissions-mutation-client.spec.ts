import { ClientProxy } from '@nestjs/microservices';
import { RoleCommands } from '@optimistic-tanuki/constants';
import { defer, lastValueFrom, of, throwError } from 'rxjs';
import { PermissionsCacheService } from './permissions-cache.service';
import { withPermissionMutationInvalidation } from './permissions-mutation-client';

describe('withPermissionMutationInvalidation', () => {
  let client: ClientProxy;
  let cacheService: Pick<
    PermissionsCacheService,
    'invalidateProfile' | 'clear'
  >;

  beforeEach(() => {
    client = { send: jest.fn() } as unknown as ClientProxy;
    cacheService = {
      invalidateProfile: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('invalidates every profile-wide cache key after an assignment succeeds and before emitting', async () => {
    const assignment = {
      id: 'assignment-1',
      profileId: 'profile-1',
      appScopeId: 'scope-1',
    };
    const events: string[] = [];
    (client.send as jest.Mock).mockReturnValue(
      defer(() => {
        events.push('mutation');
        return of(assignment);
      })
    );
    (cacheService.invalidateProfile as jest.Mock).mockImplementation(
      async (profileId: string) => {
        events.push(`invalidate:${profileId}`);
      }
    );

    const wrapped = withPermissionMutationInvalidation(client, cacheService);
    const result = await lastValueFrom(
      wrapped.send({ cmd: RoleCommands.Assign }, assignment)
    );

    expect(result).toBe(assignment);
    expect(events).toEqual(['mutation', 'invalidate:profile-1']);
    expect(cacheService.invalidateProfile).toHaveBeenCalledWith('profile-1');
  });

  it('invalidates the affected profile returned by an exact unassign acknowledgement', async () => {
    const acknowledgement = {
      success: true,
      assignmentId: 'assignment-1',
      profileId: 'profile-1',
    };
    (client.send as jest.Mock).mockReturnValue(of(acknowledgement));

    const wrapped = withPermissionMutationInvalidation(client, cacheService);
    await expect(
      lastValueFrom(
        wrapped.send(
          { cmd: RoleCommands.Unassign },
          {
            assignmentId: 'assignment-1',
          }
        )
      )
    ).resolves.toEqual(acknowledgement);

    expect(cacheService.invalidateProfile).toHaveBeenCalledWith('profile-1');
  });

  it('preserves idempotent exact unassign acknowledgements with unknown profile via fenced clear', async () => {
    const acknowledgement = {
      success: true,
      assignmentId: 'assignment-missing',
      profileId: null,
      changed: false,
    };
    (client.send as jest.Mock).mockReturnValue(of(acknowledgement));
    const wrapped = withPermissionMutationInvalidation(client, cacheService);

    await expect(
      lastValueFrom(
        wrapped.send(
          { cmd: RoleCommands.Unassign },
          {
            assignmentId: acknowledgement.assignmentId,
          }
        )
      )
    ).resolves.toEqual(acknowledgement);
    expect(cacheService.clear).toHaveBeenCalledTimes(1);
    expect(cacheService.invalidateProfile).not.toHaveBeenCalled();
  });

  it('invalidates all changed profiles in a successful bulk mutation', async () => {
    (client.send as jest.Mock).mockReturnValue(
      of({ affectedProfileIds: ['profile-1', 'profile-2'], completedCount: 2 })
    );

    const wrapped = withPermissionMutationInvalidation(client, cacheService);
    await lastValueFrom(
      wrapped.send(
        { cmd: RoleCommands.ExecuteBulkMutation },
        { operation: 'unassign' }
      )
    );

    expect(cacheService.invalidateProfile).toHaveBeenNthCalledWith(
      1,
      'profile-1'
    );
    expect(cacheService.invalidateProfile).toHaveBeenNthCalledWith(
      2,
      'profile-2'
    );
  });

  it('invalidates the profile named by a target-scoped unassign command', async () => {
    (client.send as jest.Mock).mockReturnValue(
      of({ success: true, profileId: 'profile-1' })
    );

    const wrapped = withPermissionMutationInvalidation(client, cacheService);
    await lastValueFrom(
      wrapped.send(
        { cmd: 'Unassign:Role:ByTarget' },
        { profileId: 'profile-1', roleId: 'role-1', appScopeId: 'scope-1' }
      )
    );

    expect(cacheService.invalidateProfile).toHaveBeenCalledWith('profile-1');
  });

  it('does not invalidate or emit success if invalidation fails', async () => {
    const assignment = { profileId: 'profile-1' };
    (client.send as jest.Mock).mockReturnValue(of(assignment));
    (cacheService.invalidateProfile as jest.Mock).mockRejectedValue(
      new Error('cache unavailable')
    );

    const wrapped = withPermissionMutationInvalidation(client, cacheService);
    await expect(
      lastValueFrom(wrapped.send({ cmd: RoleCommands.Assign }, assignment))
    ).rejects.toThrow('cache unavailable');
  });

  it('invalidates known affected profiles when a mutation RPC fails ambiguously', async () => {
    (client.send as jest.Mock).mockReturnValue(
      throwError(() => new Error('permissions service unavailable'))
    );

    const wrapped = withPermissionMutationInvalidation(client, cacheService);
    await expect(
      lastValueFrom(
        wrapped.send({ cmd: RoleCommands.Assign }, { profileId: 'profile-1' })
      )
    ).rejects.toThrow('permissions service unavailable');
    expect(cacheService.invalidateProfile).toHaveBeenCalledWith('profile-1');
  });

  it('clears cache when exact unassign fails with an ambiguous transport result', async () => {
    (client.send as jest.Mock).mockReturnValue(
      throwError(() => new Error('connection reset after commit'))
    );
    const wrapped = withPermissionMutationInvalidation(client, cacheService);
    await expect(
      lastValueFrom(
        wrapped.send({ cmd: RoleCommands.Unassign }, { assignmentId: 'a-1' })
      )
    ).rejects.toThrow('connection reset after commit');
    expect(cacheService.clear).toHaveBeenCalledTimes(1);
  });

  it('invalidates selected bulk profiles when a partially completed mutation errors', async () => {
    (client.send as jest.Mock).mockReturnValue(
      throwError(() => new Error('partial bulk failure'))
    );
    const wrapped = withPermissionMutationInvalidation(client, cacheService);
    await expect(
      lastValueFrom(
        wrapped.send(
          { cmd: RoleCommands.ExecuteBulkMutation },
          { operation: 'unassign', profileIds: ['profile-1', 'profile-2'] }
        )
      )
    ).rejects.toThrow('partial bulk failure');
    expect(cacheService.invalidateProfile).toHaveBeenCalledTimes(2);
    expect(cacheService.invalidateProfile).toHaveBeenNthCalledWith(
      1,
      'profile-1'
    );
    expect(cacheService.invalidateProfile).toHaveBeenNthCalledWith(
      2,
      'profile-2'
    );
  });

  it('preserves non-mutation RPC streams and ClientProxy methods', async () => {
    const response = { id: 'scope-1' };
    const connect = jest.fn().mockResolvedValue(undefined);
    (client as any).connect = connect;
    (client.send as jest.Mock).mockReturnValue(of(response));

    const wrapped = withPermissionMutationInvalidation(client, cacheService);
    await expect(
      lastValueFrom(wrapped.send({ cmd: RoleCommands.Get }, 'scope-1'))
    ).resolves.toBe(response);
    await wrapped.connect();

    expect(cacheService.invalidateProfile).not.toHaveBeenCalled();
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
