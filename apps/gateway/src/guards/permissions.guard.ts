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
} from '../decorators/permissions.decorator';
import { PermissionsCacheService } from '../auth/permissions-cache.service';
import { ProfileDto } from '@optimistic-tanuki/models';

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

    if (!requirement) {
      return true; // No permissions required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    this.logger.log(`Checking permissions for user: ${JSON.stringify(user)}`);

    if (!user || !user.profileId) {
      this.logger.warn('User not authenticated or missing profileId');
      throw new ForbiddenException('User not authenticated');
    }

    // Extract app scope from header
    const appScopeName = request.headers['x-ot-appscope'];

    if (!appScopeName) {
      this.logger.warn('App scope header (x-ot-appscope) is missing');
      throw new ForbiddenException(
        'App scope header (x-ot-appscope) is required'
      );
    }

    // Get the app scope by name
    const appScope = await firstValueFrom(
      this.permissionsClient.send(
        { cmd: AppScopeCommands.GetByName },
        appScopeName
      )
    );

    if (!appScope) {
      this.logger.warn(`App scope not found: ${appScopeName}`);
      throw new ForbiddenException(`App scope not found: ${appScopeName}`);
    }

    const profiles: ProfileDto[] = await firstValueFrom(
      this.profileService.send(
        { cmd: ProfileCommands.GetAll },
        {
          where: {
            userId: user.id,
          },
        }
      )
    );

    // Check for global scope first - if user has permission in global scope, allow access
    const globalProfile = profiles.find((p) => p.appScope === 'global');
    const appScopeProfile = profiles.find((p) => p.appScope === appScopeName);

    // Determine if we should check global scope permissions first
    const checkGlobalFirst = !!globalProfile;

    // Get the global scope for permission checking
    const globalScope = checkGlobalFirst
      ? await firstValueFrom(
          this.permissionsClient.send(
            { cmd: AppScopeCommands.GetByName },
            'global'
          )
        )
      : null;

    const { permissions } = requirement;

    // First, try to authorize with global scope permissions (if user has global profile)
    if (checkGlobalFirst && globalScope) {
      let allGlobalPermissionsGranted = true;

      for (const permission of permissions) {
        let hasPermission = await this.cacheService.get(
          user.profileId,
          permission,
          globalScope.id
        );

        if (hasPermission === null) {
          this.logger.debug(
            `Cache miss for global permission: ${permission}, checking with permissions service`
          );
          hasPermission = await firstValueFrom(
            this.permissionsClient.send(
              { cmd: RoleCommands.CheckPermission },
              {
                profileId: user.profileId,
                permission,
                profileAppScope: 'global',
                appScopeId: globalScope.id,
              }
            )
          );

          await this.cacheService.set(
            user.profileId,
            permission,
            globalScope.id,
            hasPermission
          );
        }

        if (!hasPermission) {
          allGlobalPermissionsGranted = false;
          break;
        }
      }

      if (allGlobalPermissionsGranted) {
        this.logger.debug(
          `Access granted via global scope permissions for profile ${user.profileId}`
        );
        return true;
      }
    }

    // If global scope didn't grant access, check app-specific scope
    // User must have a profile matching the app scope
    if (!appScopeProfile) {
      this.logger.warn(
        `No valid profile found for profileId: ${user.profileId} in app scope: ${appScopeName}. Will attempt fallback to global permissions.`
      );
      // Don't throw here - try global fallback in the permission check instead
    }

    // Check each required permission for the specific app scope
    for (const permission of permissions) {
      // Try to get from cache first
      let hasPermission = await this.cacheService.get(
        user.profileId,
        permission,
        appScope.id
      );

      // If not in cache, check with permissions service
      if (hasPermission === null) {
        this.logger.debug(
          `Cache miss for permission: ${permission}, checking with permissions service`
        );
        hasPermission = await firstValueFrom(
          this.permissionsClient.send(
            { cmd: RoleCommands.CheckPermission },
            {
              profileId: user.profileId,
              permission,
              profileAppScope: appScopeName,
              appScopeId: appScope.id,
              checkGlobalFallback: true, // Enable global fallback for app-scope checks
            }
          )
        );

        console.log(hasPermission);

        // Cache the result
        await this.cacheService.set(
          user.profileId,
          permission,
          appScope.id,
          hasPermission
        );
      } else {
        this.logger.debug(
          `Cache hit for permission: ${permission}, granted=${hasPermission}`
        );
      }

      if (!hasPermission) {
        this.logger.warn(
          `Permission denied: ${permission} in app scope ${appScopeName} for profile ${user.profileId}`
        );
        throw new ForbiddenException(
          `Permission denied: ${permission} in app scope ${appScopeName}`
        );
      }
    }

    return true;
  }
}
