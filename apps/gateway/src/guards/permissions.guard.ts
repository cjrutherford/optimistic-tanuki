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
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import {
  PERMISSIONS_KEY,
  PermissionRequirement,
} from '../decorators/permissions.decorator';
import { PermissionsCacheService } from '../auth/permissions-cache.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private permissionsClient: ClientProxy,
    private readonly logger: Logger,
    private readonly cacheService: PermissionsCacheService
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

    const { permissions } = requirement;

    // Check each required permission for the specific app scope
    for (const permission of permissions) {
      // Try to get from cache first
      let hasPermission = this.cacheService.get(
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
              appScope: appScope.id,
            }
          )
        );

        // Cache the result
        this.cacheService.set(
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
