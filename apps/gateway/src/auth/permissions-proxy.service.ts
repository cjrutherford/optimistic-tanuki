import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ServiceTokens,
  RoleCommands,
  AppScopeCommands,
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import { PermissionsCacheService } from './permissions-cache.service';

@Injectable()
export class PermissionsProxyService {
  private readonly logger = new Logger(PermissionsProxyService.name);

  constructor(
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy,
    private readonly cacheService: PermissionsCacheService
  ) {}

  async checkPermission(
    profileId: string,
    permission: string,
    appScopeName: string
  ): Promise<boolean> {
    try {
      // 1. Get app scope by name
      const appScope = await firstValueFrom(
        this.permissionsClient.send(
          { cmd: AppScopeCommands.GetByName },
          { name: appScopeName }
        )
      );

      if (!appScope) {
        this.logger.warn(`App scope not found: ${appScopeName}`);
        return false;
      }

      // 2. Try cache
      let hasPermission = await this.cacheService.get(
        profileId,
        permission,
        appScope.id
      );

      if (hasPermission !== null) {
        return hasPermission;
      }

      // 3. Check with permissions service (with global fallback)
      hasPermission = await firstValueFrom(
        this.permissionsClient.send(
          { cmd: RoleCommands.CheckPermission },
          {
            profileId,
            permission,
            profileAppScope: appScopeName,
            appScopeId: appScope.id,
            checkGlobalFallback: true,
          }
        )
      );

      // 4. Cache and return
      await this.cacheService.set(
        profileId,
        permission,
        appScope.id,
        hasPermission
      );

      return !!hasPermission;
    } catch (error) {
      this.logger.error(
        `Error checking permission ${permission} for profile ${profileId}`,
        error
      );
      return false;
    }
  }
}
