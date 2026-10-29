import { ClientProxy } from '@nestjs/microservices';
import { PermissionCommands, RoleCommands } from '@optimistic-tanuki/constants';
import { catchError, from, Observable, concatMap, throwError } from 'rxjs';
import { PermissionsCacheService } from './permissions-cache.service';

const BY_TARGET_UNASSIGN = 'Unassign:Role:ByTarget';

/**
 * Wrap only the permissions ClientProxy. Every gateway caller using this
 * configured token then shares the same post-persistence cache invalidation.
 */
export function withPermissionMutationInvalidation(
  client: ClientProxy,
  cache: Pick<
    PermissionsCacheService,
    'invalidateProfile' | 'invalidateAccountProfiles' | 'clear'
  >
): ClientProxy {
  return new Proxy(client, {
    get(target, property) {
      if (property !== 'send') {
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }

      return (pattern: unknown, data: unknown): Observable<unknown> => {
        const source = target.send(pattern as never, data as never);
        return source.pipe(
          concatMap((result) =>
            from(
              affectedProfiles(pattern, data, result, cache).then(
                async (profiles) => {
                  for (const profileId of profiles) {
                    await cache.invalidateProfile(profileId);
                  }
                  return result;
                }
              )
            )
          ),
          catchError((error) =>
            from(invalidateAmbiguousMutation(pattern, data, cache)).pipe(
              concatMap(() => throwError(() => error))
            )
          )
        );
      };
    },
  });
}

async function invalidateAmbiguousMutation(
  pattern: unknown,
  data: unknown,
  cache: Pick<
    PermissionsCacheService,
    'invalidateProfile' | 'invalidateAccountProfiles' | 'clear'
  >
): Promise<void> {
  const command =
    typeof pattern === 'string'
      ? pattern
      : (pattern as { cmd?: string } | null)?.cmd;
  const payload = (data || {}) as Record<string, unknown>;
  if (
    [
      RoleCommands.Update,
      RoleCommands.Delete,
      RoleCommands.AddPermission,
      RoleCommands.RemovePermission,
      PermissionCommands.Create,
      PermissionCommands.Update,
      PermissionCommands.Delete,
    ].includes(command as never)
  ) {
    await cache.clear();
    return;
  }
  let ids: unknown[] = [];
  if (command === RoleCommands.Assign || command === BY_TARGET_UNASSIGN) {
    ids = [payload.profileId];
  } else if (command === RoleCommands.ExecuteBulkMutation) {
    ids = Array.isArray(payload.profileIds) ? payload.profileIds : [];
  } else if (command === RoleCommands.Unassign) {
    // The request has only assignmentId. Evict all decisions because the
    // service may have committed before a transport error was observed.
    await cache.clear();
    return;
  }
  for (const profileId of new Set(
    ids.filter((id): id is string => typeof id === 'string' && !!id)
  )) {
    await cache.invalidateProfile(profileId);
  }
}

async function affectedProfiles(
  pattern: unknown,
  data: unknown,
  result: unknown,
  cache: Pick<
    PermissionsCacheService,
    'invalidateProfile' | 'invalidateAccountProfiles' | 'clear'
  >
): Promise<string[]> {
  const command =
    typeof pattern === 'string'
      ? pattern
      : (pattern as { cmd?: string } | null)?.cmd;
  const payload = (data || {}) as Record<string, unknown>;
  const response = (result || {}) as Record<string, unknown>;
  if (
    [
      RoleCommands.Update,
      RoleCommands.Delete,
      RoleCommands.AddPermission,
      RoleCommands.RemovePermission,
      PermissionCommands.Create,
      PermissionCommands.Update,
      PermissionCommands.Delete,
    ].includes(command as never)
  ) {
    await cache.clear();
    return [];
  }
  let ids: unknown[] = [];

  if (command === RoleCommands.Assign) {
    ids = [payload.profileId];
  } else if (command === RoleCommands.Unassign) {
    if (response.changed === false && !response.profileId) {
      await cache.clear();
      return [];
    }
    ids = [response.profileId];
  } else if (command === BY_TARGET_UNASSIGN) {
    ids = [response.profileId || payload.profileId];
  } else if (command === RoleCommands.ExecuteBulkMutation) {
    ids = Array.isArray(response.affectedProfileIds)
      ? response.affectedProfileIds
      : [];
  }

  if (
    (command === RoleCommands.Assign ||
      (command === RoleCommands.Unassign && response.changed !== false) ||
      command === BY_TARGET_UNASSIGN) &&
    !ids.some((id) => typeof id === 'string' && id)
  ) {
    throw new Error(
      `Permissions mutation ${command} omitted affected profileId`
    );
  }

  return Array.from(
    new Set(ids.filter((id): id is string => typeof id === 'string' && !!id))
  );
}
