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
      // Check with the permissions service on a miss. The cache service fences
      // this lookup against role mutations that overlap the RPC.
      const hasPermission = await this.cacheService.getOrLoad(
        profileId,
        permission,
        appScope.id,
        undefined,
        async () =>
          await firstValueFrom(
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
          )
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
