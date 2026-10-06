import {
  BadRequestException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { APP_SCOPE } from '@optimistic-tanuki/civic-access';
import type { Actor } from '@optimistic-tanuki/civic-community';
import { AppScopeCommands, RoleCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import type { UserDetails } from '../../decorators/user.decorator';

/** How long a lookup or an ordinary contributions call may take. */
const CALL_TIMEOUT_MS = 15_000;

interface RoleAssignmentRecord {
  role?: { name?: string; permissions?: { name?: string }[] };
  appScope?: { name?: string };
}

/** What an account holds in the local-hub scope. */
export interface LocalHubAccess {
  roles: string[];
  permissions: string[];
}

/**
 * The gateway's side of civic-contributions: resolves who is acting (always
 * with their local-hub roles, D23), sends commands, and assigns the role a
 * verified official earns. Failures of the services behind it surface as
 * 503, never as an actor without roles.
 */
export class CivicContributionsClient {
  private readonly logger = new Logger(CivicContributionsClient.name);

  constructor(
    private readonly contributions: ClientProxy,
    private readonly permissions: ClientProxy
  ) {}

  /** The account's local-hub role and permission names. 503 when they cannot be read. */
  async access(profileId: string): Promise<LocalHubAccess> {
    let assignments: RoleAssignmentRecord[];
    try {
      assignments = await firstValueFrom(
        this.permissions
          .send<RoleAssignmentRecord[]>(
            { cmd: RoleCommands.GetUserRoles },
            { profileId, appScope: APP_SCOPE }
          )
          .pipe(timeout(CALL_TIMEOUT_MS))
      );
    } catch (error) {
      this.logger.warn(`role lookup failed: ${describe(error)}`);
      throw new ServiceUnavailableException(
        'Your roles cannot be checked right now. Try again shortly.'
      );
    }
    if (!Array.isArray(assignments)) {
      throw new ServiceUnavailableException(
        'Your roles cannot be checked right now. Try again shortly.'
      );
    }
    // GetUserRoles may also return global assignments; only this
    // application's count here.
    const local = assignments.filter((a) => a.appScope?.name === APP_SCOPE);
    const roles = new Set<string>();
    const permissions = new Set<string>();
    for (const assignment of local) {
      if (assignment.role?.name) roles.add(assignment.role.name);
      for (const permission of assignment.role?.permissions ?? []) {
        if (permission.name) permissions.add(permission.name);
      }
    }
    return { roles: [...roles].sort(), permissions: [...permissions].sort() };
  }

  /** The acting account, always carrying its roles. */
  async actor(user: UserDetails): Promise<{ actor: Actor } & LocalHubAccess> {
    if (!user.profileId) {
      throw new ForbiddenException(
        'Your account has no local-hub profile yet; sign in again.'
      );
    }
    const access = await this.access(user.profileId);
    return {
      actor: {
        userId: user.userId,
        profileId: user.profileId,
        handle: user.name,
        roles: access.roles,
      },
      ...access,
    };
  }

  /** Assigns a local-hub role to a profile; the assignment is idempotent upstream. */
  async grantRole(profileId: string, roleName: string): Promise<void> {
    try {
      const scope = await this.ask<{ id: string } | null>(
        this.permissions,
        AppScopeCommands.GetByName,
        { name: APP_SCOPE }
      );
      const role = await this.ask<{ id: string } | null>(
        this.permissions,
        RoleCommands.GetByName,
        { name: roleName, appScope: APP_SCOPE }
      );
      if (!scope?.id || !role?.id) {
        throw new Error(
          `the ${APP_SCOPE} scope or its ${roleName} role is missing`
        );
      }
      await this.ask(this.permissions, RoleCommands.Assign, {
        roleId: role.id,
        profileId,
        appScopeId: scope.id,
      });
    } catch (error) {
      this.logger.error(`granting ${roleName} failed: ${describe(error)}`);
      throw new ServiceUnavailableException(
        'Your standing was recorded but the role could not be assigned. Apply again shortly.'
      );
    }
  }

  /** A command to civic-contributions. A message meant for a person (NOTICE:) is a 400. */
  async call<T>(
    cmd: string,
    payload: object,
    deadlineMs = CALL_TIMEOUT_MS
  ): Promise<T> {
    try {
      return await this.ask<T>(this.contributions, cmd, payload, deadlineMs);
    } catch (error) {
      const message = describe(error);
      if (message.startsWith('NOTICE: ')) {
        throw new BadRequestException(message.slice('NOTICE: '.length));
      }
      this.logger.error(`civic-contributions ${cmd} failed: ${message}`);
      throw new ServiceUnavailableException(
        'The community service is unavailable. Try again shortly.'
      );
    }
  }

  private ask<T>(
    client: ClientProxy,
    cmd: string,
    payload: object,
    deadlineMs = CALL_TIMEOUT_MS
  ): Promise<T> {
    return firstValueFrom(
      client.send<T>({ cmd }, payload).pipe(timeout(deadlineMs))
    );
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return String(error);
}
