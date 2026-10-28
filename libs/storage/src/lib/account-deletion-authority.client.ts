import { ClientProxy } from '@nestjs/microservices';
import { AuthCommands } from '@optimistic-tanuki/constants';
import {
  AccountDeletionAction,
  AccountDeletionGrant,
  AccountDeletionIdentityDomains,
  AccountDeletionOwner,
  validateDeletionGrantShape,
  validateDeletionIdentityDomains,
} from '@optimistic-tanuki/models';
import { firstValueFrom, timeout } from 'rxjs';

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
/** Deletion recovery deliberately does not depend on the revoked user's session. */
export class AccountDeletionAuthorityClient {
  constructor(private readonly auth: Pick<ClientProxy, 'send'>) {}

  async validate(
    value: unknown,
    owner: AccountDeletionOwner,
    action: AccountDeletionAction
  ): Promise<{
    accountId: string;
    scope: AccountDeletionIdentityDomains | null;
  }> {
    if (
      !validateDeletionGrantShape(value) ||
      value.owner !== owner ||
      value.action !== action
    )
      throw new Error('ACCOUNT_DELETION_GRANT_OWNER_OR_ACTION_INVALID');
    const reply: unknown = await firstValueFrom(
      this.auth
        .send({ cmd: AuthCommands.ValidateAccountDeletionGrant }, value)
        .pipe(timeout(3000))
    );
    if (
      !record(reply) ||
      Object.keys(reply).sort().join(',') !== 'accountId,scope,valid' ||
      reply['valid'] !== true ||
      reply['accountId'] !== value.accountId ||
      !(
        reply['scope'] === null ||
        validateDeletionIdentityDomains(reply['scope'])
      )
    )
      throw new Error('ACCOUNT_DELETION_AUTHORITY_REPLY_INVALID');
    if (reply['scope'] === null && !(owner === 'profile' && action === 'fence'))
      throw new Error('ACCOUNT_DELETION_SCOPE_REQUIRED');
    const scope = reply['scope'] as AccountDeletionIdentityDomains | null;
    return {
      accountId: value.accountId,
      scope: scope
        ? {
            currentProfileIds: [...scope.currentProfileIds],
            legacyProfileIds: [...scope.legacyProfileIds],
          }
        : null,
    };
  }

  async recordProfileScope(
    grant: AccountDeletionGrant,
    scope: AccountDeletionIdentityDomains
  ): Promise<void> {
    if (
      !validateDeletionGrantShape(grant) ||
      grant.owner !== 'profile' ||
      grant.action !== 'fence' ||
      !validateDeletionIdentityDomains(scope)
    )
      throw new Error('ACCOUNT_DELETION_SCOPE_INVALID');
    const reply: unknown = await firstValueFrom(
      this.auth
        .send(
          { cmd: AuthCommands.RecordAccountDeletionProfileScope },
          { grant, scope }
        )
        .pipe(timeout(3000))
    );
    if (
      !record(reply) ||
      Object.keys(reply).sort().join(',') !==
        'attempt,legacyCount,operationId,profileCount,recorded' ||
      reply['recorded'] !== true ||
      reply['operationId'] !== grant.operationId ||
      reply['attempt'] !== grant.attempt ||
      reply['profileCount'] !== scope.currentProfileIds.length ||
      reply['legacyCount'] !== scope.legacyProfileIds.length
    )
      throw new Error('ACCOUNT_DELETION_SCOPE_REPLY_INVALID');
  }
}
