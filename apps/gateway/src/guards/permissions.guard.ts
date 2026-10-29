import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import {
  ServiceTokens,
  RoleCommands,
  AppScopeCommands,
  ProfileCommands,
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import {
  PERMISSIONS_KEY,
  PermissionRequirement,
  PERMISSION_TARGET_KEY,
  PermissionTargetRequirement,
} from '../decorators/permissions.decorator';
import { PermissionsCacheService } from '../auth/permissions-cache.service';
import { ProfileDto } from '@optimistic-tanuki/models';
import { emitSafeDiagnostic } from '@optimistic-tanuki/logger';
import {
  WORKSPACE_CONTEXT_KEY,
  WorkspaceContextRequirement,
} from '../decorators/workspace-context.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private permissionsClient: ClientProxy,
    private readonly logger: Logger,
    private readonly cacheService: PermissionsCacheService,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileService: ClientProxy
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );
    const targetRequirement =
      this.reflector.getAllAndOverride<PermissionTargetRequirement>(
        PERMISSION_TARGET_KEY,
        [context.getHandler(), context.getClass()]
      );

    if (!requirement) {
      return true; // No permissions required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    emitSafeDiagnostic(this.logger, 'authorization.check.started');

    if (!user) {
      emitSafeDiagnostic(
        this.logger,
        'authorization.operation',
        undefined,
        'warn'
      );
      throw new ForbiddenException('User not authenticated');
    }

    // A controller-level PermissionsGuard runs before method-level guards. If
    // this handler requires workspace resolution, defer this early pass so the
    // method-level WorkspaceContextGuard can attach the authoritative child
    // scope before PermissionsGuard evaluates the permission. Only recognize
    // actual workspace metadata here: the guard must not defer when a test or
    // caller reflects unrelated permission metadata for another key.
    const workspaceRequirement =
      this.reflector.getAllAndOverride<WorkspaceContextRequirement>(
        WORKSPACE_CONTEXT_KEY,
        [context.getHandler(), context.getClass()]
      );
    const hasWorkspaceMetadata =
      !!workspaceRequirement &&
      typeof workspaceRequirement.source === 'string' &&
      typeof workspaceRequirement.path === 'string';
    const workspaceSelector = hasWorkspaceMetadata
      ? request[workspaceRequirement.source]?.[workspaceRequirement.path]
      : undefined;
    if (
      hasWorkspaceMetadata &&
      !request.workspaceContext &&
      (!workspaceRequirement.optional ||
        (typeof workspaceSelector === 'string' && workspaceSelector.trim()))
    ) {
      return true;
    }

    // Extract app scope from header
    const appScopeName = request.headers['x-ot-appscope'];

    if (!appScopeName) {
      emitSafeDiagnostic(
        this.logger,
        'authorization.operation',
        undefined,
        'warn'
      );
      throw new ForbiddenException(
        'App scope header (x-ot-appscope) is required'
      );
    }

    // Get the app scope by name
    const appScope = await firstValueFrom(
      this.permissionsClient.send(
        { cmd: AppScopeCommands.GetByName },
        { name: appScopeName }
      )
    );

    if (!appScope) {
      emitSafeDiagnostic(
        this.logger,
        'authorization.operation',
        undefined,
        'warn'
      );
      throw new ForbiddenException(`App scope not found: ${appScopeName}`);
    }

    const profiles: ProfileDto[] = await firstValueFrom(
      this.profileService.send(
        { cmd: ProfileCommands.GetAll },
        {
          where: {
            userId: user.userId,
          },
        }
      )
    );

    const globalProfile = profiles.find(
      (p) => !p.appScope || p.appScope === 'global'
    );
    const appScopeProfile = profiles.find((p) => p.appScope === appScopeName);
    const currentProfile = profiles.find((p) => p.id === user.profileId);

    // If the JWT is missing profileId (for example, after initial
    // registration or before a re-login that encodes it), attempt to
    // resolve an appropriate profile for this request and attach it to
    // the user context so permission checks can proceed.
    if (!user.profileId) {
      const fallbackProfile = appScopeProfile || globalProfile || profiles[0];

      if (!fallbackProfile) {
        emitSafeDiagnostic(
          this.logger,
          'authorization.operation',
          undefined,
          'warn'
        );
        throw new ForbiddenException('User profile required for this action');
      }

      user.profileId = fallbackProfile.id;
      request.user = user;
      emitSafeDiagnostic(
        this.logger,
        'authorization.operation',
        undefined,
        'debug'
      );
    } else if (appScopeProfile && currentProfile?.appScope !== appScopeName) {
      user.profileId = appScopeProfile.id;
      request.user = user;
      emitSafeDiagnostic(
        this.logger,
        'authorization.operation',
        undefined,
        'debug'
      );
    }

    // Check for global scope first - if user has permission in global scope, allow access
    const globalPermissionProfileId = globalProfile?.id || user.profileId;
    const appScopePermissionProfileId = appScopeProfile?.id || user.profileId;

    // Determine if we should check global scope permissions first
    const checkGlobalFirst = !!globalProfile;

    // Get the global scope for permission checking
    const globalScope = checkGlobalFirst
      ? await firstValueFrom(
          this.permissionsClient.send(
            { cmd: AppScopeCommands.GetByName },
            { name: 'global' }
          )
        )
      : null;

    const { permissions } = requirement;

    const targetId = this.resolveTargetId(request, targetRequirement);
    if (targetId) {
      emitSafeDiagnostic(
        this.logger,
        'authorization.operation',
        undefined,
        'debug'
      );
    }

    // First, try to authorize with global scope permissions (if user has global profile)
    if (checkGlobalFirst && globalScope) {
      let allGlobalPermissionsGranted = true;

      for (const permission of permissions) {
        const hasPermission = await this.cacheService.getOrLoad(
          globalPermissionProfileId,
          permission,
          globalScope.id,
          targetId,
          async () => {
            emitSafeDiagnostic(
              this.logger,
              'authorization.operation',
              undefined,
              'debug'
            );
            return await firstValueFrom(
              this.permissionsClient.send(
                { cmd: RoleCommands.CheckPermission },
                {
                  profileId: globalPermissionProfileId,
                  permission,
                  profileAppScope: 'global',
                  appScopeId: globalScope.id,
                  targetId,
                }
              )
            );
          }
        );

        if (!hasPermission) {
          allGlobalPermissionsGranted = false;
          break;
        }
      }

      if (allGlobalPermissionsGranted) {
        emitSafeDiagnostic(
          this.logger,
          'authorization.operation',
          undefined,
          'debug'
        );
        return true;
      }
    }

    const workspaceContext = request.workspaceContext as
      | {
          workspace?: { appScope?: string };
          workspaceScope?: string;
          strict?: boolean;
        }
      | undefined;
    if (workspaceContext?.workspaceScope) {
      if (workspaceContext.workspace?.appScope !== appScopeName) {
        throw new ForbiddenException(
          'Workspace does not belong to this app scope'
        );
      }
      const workspaceScope = await firstValueFrom(
        this.permissionsClient.send(
          { cmd: AppScopeCommands.GetByName },
          { name: workspaceContext.workspaceScope }
        )
      );
      if (!workspaceScope) {
        throw new ForbiddenException(
          'Workspace permission scope was not found'
        );
      }

      let allWorkspacePermissionsGranted = true;
      for (const permission of permissions) {
        const hasPermission = await this.cacheService.getOrLoad(
          appScopePermissionProfileId,
          permission,
          workspaceScope.id,
          targetId,
          async () =>
            await firstValueFrom(
              this.permissionsClient.send(
                { cmd: RoleCommands.CheckPermission },
                {
                  profileId: appScopePermissionProfileId,
                  permission,
                  profileAppScope: workspaceContext.workspaceScope,
                  appScopeId: workspaceScope.id,
                  targetId,
                }
              )
            )
        );
        if (!hasPermission) {
          allWorkspacePermissionsGranted = false;
          break;
        }
      }
      if (allWorkspacePermissionsGranted) {
        return true;
      }
      if (workspaceContext.strict) {
        throw new ForbiddenException('Workspace permission denied');
      }
    }

    // If global scope didn't grant access, check app-specific scope
    // User must have a profile matching the app scope
    if (!appScopeProfile) {
      emitSafeDiagnostic(
        this.logger,
        'authorization.operation',
        undefined,
        'warn'
      );
      // Don't throw here - try global fallback in the permission check instead
    }

    // Check each required permission for the specific app scope
    for (const permission of permissions) {
      // Try to get from cache first
      const hasPermission = await this.cacheService.getOrLoad(
        appScopePermissionProfileId,
        permission,
        appScope.id,
        targetId,
        async () => {
          emitSafeDiagnostic(
            this.logger,
            'authorization.operation',
            undefined,
            'debug'
          );
          return await firstValueFrom(
            this.permissionsClient.send(
              { cmd: RoleCommands.CheckPermission },
              {
                profileId: appScopePermissionProfileId,
                permission,
                profileAppScope: appScopeName,
                appScopeId: appScope.id,
                checkGlobalFallback: true,
                targetId,
              }
            )
          );
        }
      );

      if (!hasPermission) {
        emitSafeDiagnostic(
          this.logger,
          'authorization.operation',
          undefined,
          'warn'
        );
        throw new ForbiddenException(
          `Permission denied: ${permission} in app scope ${appScopeName}`
        );
      }
    }

    return true;
  }

  private resolveTargetId(
    request: Record<string, any>,
    targetRequirement?: PermissionTargetRequirement
  ): string | null {
    if (targetRequirement) {
      const source = request[targetRequirement.source];
      const resolved = this.getValueByPath(source, targetRequirement.path);

      if (typeof resolved === 'string' && resolved.trim()) {
        return resolved;
      }

      return null;
    }

    const routeTargetId = request.params?.id;
    return typeof routeTargetId === 'string' && routeTargetId.trim()
      ? routeTargetId
      : null;
  }

  private getValueByPath(source: unknown, path: string): unknown {
    if (!source || !path) {
      return undefined;
    }

    return path.split('.').reduce<unknown>((current, segment) => {
      if (current && typeof current === 'object' && segment in current) {
        return (current as Record<string, unknown>)[segment];
      }

      return undefined;
    }, source);
  }
}
