import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AccountDeletionGrant,
  validateDeletionIdentityDomains,
} from '@optimistic-tanuki/models';
import { AccountDeletionAuthorityClient } from '@optimistic-tanuki/storage';
/** D26 only: authority refuses this distinct capability until all owners and non-ORM stores verify. */
@Injectable()
export class ProfileAccountDeletionFinalizerService {
  constructor(
    @Inject('PROFILE_CONNECTION') private readonly db: DataSource,
    private readonly authority: AccountDeletionAuthorityClient
  ) {}
  async finalize(grant: AccountDeletionGrant) {
    const { scope } = await this.authority.validate(
      grant,
      'profile',
      'finalize'
    );
    if (
      !scope ||
      !validateDeletionIdentityDomains(scope) ||
      scope.legacyProfileIds.length ||
      scope.currentProfileIds.length > 999
    )
      throw Error('PROFILE_FINALIZATION_SCOPE');
    await this.db.transaction(async (m) => {
      await m.query("SET LOCAL lock_timeout='5s'");
      await m.query("SET LOCAL statement_timeout='12s'");
      await m.query("SELECT set_config('ot.deletion_operation',$1,true)", [
        grant.operationId,
      ]);
      const rows = await m.query(
        'SELECT id FROM profile WHERE lower("userId")=$1 ORDER BY id FOR UPDATE',
        [grant.accountId]
      );
      if (
        rows.length > 999 ||
        rows.some((r) => !scope.currentProfileIds.includes(r.id))
      )
        throw Error('PROFILE_FINALIZATION_BINDING');
      await this.authority.validate(grant, 'profile', 'finalize');
      await m.query(
        'DELETE FROM profile WHERE lower("userId")=$1 AND id=ANY($2::uuid[])',
        [grant.accountId, scope.currentProfileIds]
      );
      const left = await m.query(
        'SELECT count(*)::text n FROM profile WHERE lower("userId")=$1 OR id=ANY($2::uuid[])',
        [grant.accountId, scope.currentProfileIds]
      );
      if (left?.length !== 1 || left[0].n !== '0')
        throw Error('PROFILE_FINALIZATION_READBACK');
      await this.authority.validate(grant, 'profile', 'finalize');
    });
    return { finalized: true as const, remaining: 0 };
  }
}
