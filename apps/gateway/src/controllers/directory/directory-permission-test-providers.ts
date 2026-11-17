import { Logger, Provider } from '@nestjs/common';
import { of } from 'rxjs';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';

interface PermissionLoader {
  getOrLoad: (
    profile: string,
    permission: string,
    scope: string,
    target: string | null,
    load: () => Promise<boolean>
  ) => Promise<boolean>;
}

/**
 * Providers PermissionsGuard needs when a spec compiles a Directory
 * controller. The permission lookup itself is answered by the spec's own
 * PERMISSIONS_SERVICE double.
 */
export const directoryPermissionTestProviders: Provider[] = [
  PermissionsGuard,
  { provide: Logger, useValue: new Logger('directory-spec') },
  {
    provide: PermissionsCacheService,
    useValue: {
      getOrLoad: (_p, _n, _s, _t, load) => load(),
    } as PermissionLoader,
  },
  {
    provide: ServiceTokens.PROFILE_SERVICE,
    useValue: { send: () => of([]) },
  },
];
