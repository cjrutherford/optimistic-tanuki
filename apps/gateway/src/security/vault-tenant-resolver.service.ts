import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  FinanceTenantCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { FinanceTenantDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { UserDetails } from '../decorators/user.decorator';
import { sanitizeTenantId } from '@optimistic-tanuki/business-security';

export const VAULT_STAFF_APP_SCOPE = 'finance';
export const VAULT_STAFF_PERMISSION = 'finance.tenant.manage';

@Injectable()
export class VaultTenantResolver {
  constructor(
    @Inject(ServiceTokens.FINANCE_SERVICE)
    private readonly financeClient: ClientProxy
  ) {}

  async resolve(
    user: Pick<UserDetails, 'userId' | 'profileId'> | null | undefined
  ): Promise<string> {
    if (!user?.userId || !user.profileId) {
      throw new ForbiddenException(
        'An authenticated finance tenant principal is required.'
      );
    }

    let tenant: FinanceTenantDto | null;
    try {
      tenant = await firstValueFrom(
        this.financeClient.send<FinanceTenantDto>(
          { cmd: FinanceTenantCommands.GET_CURRENT_TENANT },
          {
            userId: user.userId,
            profileId: user.profileId,
            appScope: VAULT_STAFF_APP_SCOPE,
          }
        )
      );
    } catch (error) {
      const status = this.getStatus(error);
      if (status === 400 || status === 403 || status === 404) {
        throw new ForbiddenException(
          'The authenticated principal is not authorized for a vault tenant.'
        );
      }
      throw new ServiceUnavailableException(
        'Vault tenant authorization is unavailable.'
      );
    }

    if (!tenant?.id) {
      throw new ForbiddenException(
        'The authenticated principal is not authorized for a vault tenant.'
      );
    }

    try {
      return sanitizeTenantId(tenant.id);
    } catch {
      throw new ForbiddenException(
        'The authenticated principal is not authorized for a vault tenant.'
      );
    }
  }

  private getStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) {
      return undefined;
    }
    if ('getStatus' in error && typeof error.getStatus === 'function') {
      const status = error.getStatus();
      return typeof status === 'number' ? status : undefined;
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return error.statusCode;
    }
    if ('status' in error && typeof error.status === 'number') {
      return error.status;
    }
    return undefined;
  }
}
