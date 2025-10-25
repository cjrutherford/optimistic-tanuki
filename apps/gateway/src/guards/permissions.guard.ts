import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import { ServiceTokens, RoleCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import { PERMISSIONS_KEY, PermissionRequirement } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private permissionsClient: ClientProxy
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

    if (!user || !user.profileId) {
      throw new ForbiddenException('User not authenticated');
    }

    const { permissions } = requirement;

    // Get all roles assigned to the user across all app scopes
    const userRoles = await firstValueFrom(
      this.permissionsClient.send(
        { cmd: RoleCommands.GetUserRoles },
        { profileId: user.profileId }
      )
    );

    if (!userRoles || userRoles.length === 0) {
      throw new ForbiddenException('No roles assigned to user');
    }

    // Check if user has ANY of the required permissions in ANY of their assigned app scopes
    for (const permission of permissions) {
      let hasPermission = false;

      // Check permission across all user's app scope assignments
      for (const roleAssignment of userRoles) {
        const appScopeId = roleAssignment.appScope?.id;
        
        if (appScopeId) {
          const permissionCheck = await firstValueFrom(
            this.permissionsClient.send(
              { cmd: RoleCommands.CheckPermission },
              {
                profileId: user.profileId,
                permission,
                appScopeId,
              }
            )
          );

          if (permissionCheck) {
            hasPermission = true;
            break; // Permission found in at least one app scope
          }
        }
      }

      if (!hasPermission) {
        throw new ForbiddenException(
          `Permission denied: ${permission}`
        );
      }
    }

    return true;
  }
}
