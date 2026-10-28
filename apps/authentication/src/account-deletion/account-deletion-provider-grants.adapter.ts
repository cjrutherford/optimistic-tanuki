import { Injectable } from '@nestjs/common';
import { validateDeletionGrantShape } from '@optimistic-tanuki/models';
import { AccountDeletionOwnerService } from './account-deletion-owner.service';
import {
  DeletionNonOrmAdapter,
  DeletionNonOrmSubject,
} from './account-deletion-non-orm.service';

/** N07 app-held provider identities. External provider account deletion is excluded. */
@Injectable()
export class AccountDeletionProviderGrantsAdapter
  implements DeletionNonOrmAdapter
{
  constructor(private readonly owner: AccountDeletionOwnerService) {}

  async purge(subject: DeletionNonOrmSubject): Promise<void> {
    // D01 must already have erased provider rows under the permanent account fence.
    // Do not turn an unexpected surviving grant into a successful cleanup receipt.
    if ((await this.readback(subject)) !== 0)
      throw Error('DELETION_PROVIDER_GRANTS_REMAIN');
  }

  async readback(subject: DeletionNonOrmSubject): Promise<number> {
    const grant = subject.grant;
    if (
      !validateDeletionGrantShape(grant) ||
      grant.owner !== 'authentication' ||
      grant.action !== 'readback' ||
      grant.accountId !== subject.accountId ||
      grant.operationId !== subject.operationId
    )
      throw Error('DELETION_PROVIDER_GRANT_INVALID');
    // Real owner readback validates the current lease/frozen scope and independently
    // counts the physical oauth_provider rows; it does not trust saved acknowledgements.
    const result = await this.owner.readback(grant);
    if (
      result?.complete !== true ||
      !Array.isArray(result.unresolvedAttribution) ||
      result.unresolvedAttribution.length !== 0
    )
      throw Error('DELETION_PROVIDER_READBACK_INVALID');
    const n = result.counts?.['oauth_provider'];
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0)
      throw Error('DELETION_PROVIDER_READBACK_INVALID');
    return n;
  }
}
