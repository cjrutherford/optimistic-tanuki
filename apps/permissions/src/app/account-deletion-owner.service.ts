import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AccountDeletionAction,
  validateDeletionGrantShape,
  validateDeletionIdentityDomains,
} from '@optimistic-tanuki/models';
import {
  AccountDeletionAuthorityClient,
  installDeletionWriteFence,
} from '@optimistic-tanuki/storage';

const LIMIT = 10000;
@Injectable()
export class PermissionsAccountDeletionOwnerService {
  constructor(
    @Inject('PERMISSIONS_CONNECTION') private readonly database: DataSource,
    private readonly authority: AccountDeletionAuthorityClient
  ) {}

  async execute(
    value: unknown,
    action: AccountDeletionAction
  ): Promise<{ verified: true; remaining: number }> {
    if (
      !validateDeletionGrantShape(value) ||
      value.owner !== 'permissions' ||
      value.action !== action ||
      !['fence', 'erase', 'readback'].includes(action)
    )
      throw new Error('PERMISSIONS_DELETION_GRANT_INVALID');
    const grant = Object.freeze({ ...value });
    const verified = await this.authority.validate(
      grant,
      'permissions',
      action
    );
    const scope = verified.scope;
    if (
      !scope ||
      !validateDeletionIdentityDomains(scope) ||
      scope.currentProfileIds.length > 999 ||
      scope.legacyProfileIds.length
    )
      throw new Error('PERMISSIONS_DELETION_SCOPE_INVALID');
    const profiles = [...scope.currentProfileIds];
    const remaining = await this.database.transaction(async (manager) => {
      await manager.query("SET LOCAL lock_timeout='4s'");
      await manager.query("SET LOCAL statement_timeout='8s'");
      await installDeletionWriteFence(manager, grant.operationId, [
        { kind: 'account', id: grant.accountId },
        ...profiles.map((id) => ({ kind: 'profile' as const, id })),
      ]);
      await manager.query(
        "SELECT set_config('ot.deletion_operation',$1,true)",
        [grant.operationId]
      );
      const fresh = await this.authority.validate(grant, 'permissions', action);
      if (JSON.stringify(fresh.scope) !== JSON.stringify(scope))
        throw new Error('PERMISSIONS_DELETION_SCOPE_CHANGED');
      const rows = await manager.query(
        `SELECT id FROM role_assignment WHERE lower("profileId")=ANY($1::text[]) ORDER BY id LIMIT ${
          LIMIT + 1
        } FOR UPDATE`,
        [profiles]
      );
      if (!Array.isArray(rows) || rows.length > LIMIT)
        throw new Error('PERMISSIONS_DELETION_ROW_BOUND');
      if (action === 'erase')
        await manager.query(
          'DELETE FROM role_assignment WHERE lower("profileId")=ANY($1::text[])',
          [profiles]
        );
      const counts = await manager.query(
        'SELECT count(*)::text AS count FROM role_assignment WHERE lower("profileId")=ANY($1::text[])',
        [profiles]
      );
      const raw = counts?.[0]?.count;
      if (
        !Array.isArray(counts) ||
        counts.length !== 1 ||
        typeof raw !== 'string' ||
        !/^\d+$/.test(raw) ||
        !Number.isSafeInteger(Number(raw)) ||
        Number(raw) > LIMIT
      )
        throw new Error('PERMISSIONS_DELETION_READBACK_INVALID');
      if (action !== 'fence' && raw !== '0')
        throw new Error('PERMISSIONS_DELETION_READBACK_NONEMPTY');
      return Number(raw);
    });
    const fresh = await this.authority.validate(grant, 'permissions', action);
    if (JSON.stringify(fresh.scope) !== JSON.stringify(scope))
      throw new Error('PERMISSIONS_DELETION_SCOPE_CHANGED');
    return { verified: true, remaining };
  }
}
