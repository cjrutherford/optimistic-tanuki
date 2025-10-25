import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import { ServiceTokens, RoleCommands, AppScopeCommands } from '@optimistic-tanuki/constants';
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

    const { permissions, appScopeName } = requirement;

    // Get the app scope by name
    const appScope = await firstValueFrom(
      this.permissionsClient.send(
        { cmd: AppScopeCommands.GetByName },
        appScopeName
      )
    );

    if (!appScope) {
      throw new ForbiddenException(`App scope not found: ${appScopeName}`);
    }

    // Check each required permission
    for (const permission of permissions) {
      const hasPermission = await firstValueFrom(
        this.permissionsClient.send(
          { cmd: RoleCommands.CheckPermission },
          {
            profileId: user.profileId,
            permission,
            appScopeId: appScope.id,
          }
        )
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          `Permission denied: ${permission} in ${appScopeName}`
        );
      }
    }

    return true;
  }
}
