import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AccountDeletionGrant,
  DELETED_ACCOUNT_ID,
} from '@optimistic-tanuki/models';
import { AccountDeletionAuthorityService } from './account-deletion-authority.service';
@Injectable()
export class AccountDeletionFinalizerService {
  constructor(
    private readonly authority: AccountDeletionAuthorityService,
    @Inject('AUTHENTICATION_CONNECTION') private readonly db: DataSource
  ) {}
  async finalize(grant: AccountDeletionGrant) {
    if (grant.owner !== 'authentication' || grant.action !== 'finalize')
      throw Error('AUTH_FINALIZATION_GRANT');
    await this.authority.validateGrant(grant);
    await this.db.transaction(async (m) => {
      await m.query("SET LOCAL lock_timeout='5s'");
      await m.query("SET LOCAL statement_timeout='12s'");
      const rows = await m.query(
        'SELECT * FROM account_deletion_operations WHERE id=$1 FOR UPDATE',
        [grant.operationId]
      );
      const operation = rows[0];
      if (
        rows.length !== 1 ||
        operation.accountId !== grant.accountId ||
        operation.attempt !== grant.attempt ||
        operation.leaseOwner !== grant.leaseOwner ||
        operation.ownerProgress?.profile?.finalize !== true ||
        !operation.ownerProgress?._nonOrm?.verified ||
        operation.ownerProgress?._nonOrm?.attempt !== grant.attempt
      )
        throw Error('AUTH_FINALIZATION_ORDER');
      await this.authority.validateGrant(grant);
      await m.query("SELECT set_config('ot.deletion_operation',$1,true)", [
        grant.operationId,
      ]);
      const users = await m.query(
        'SELECT id,"keyDataId" FROM user_entity WHERE id=$1 FOR UPDATE',
        [grant.accountId]
      );
      if (users.length !== 1) throw Error('AUTH_FINALIZATION_ROOT_MISSING');
      // Historical physical schema uses userId, whereas older ORM registrations can spell it UserId.
      const columns = await m.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='key_datum' AND lower(column_name)='userid'`
      );
      if (
        columns.length !== 1 ||
        !['userId', 'UserId'].includes(columns[0].column_name)
      )
        throw Error('AUTH_FINALIZATION_KEY_CATALOG');
      const col = columns[0].column_name;
      const keys = await m.query(
        `SELECT id,"${col}" AS owner FROM key_datum WHERE "${col}"=$1 OR id=$2 FOR UPDATE`,
        [grant.accountId, users[0].keyDataId]
      );
      if (
        keys.length > 2 ||
        keys.some((k) => k.owner !== null && k.owner !== grant.accountId) ||
        (users[0].keyDataId && !keys.some((k) => k.id === users[0].keyDataId))
      )
        throw Error('AUTH_FINALIZATION_KEY_BINDING');
      const ids = keys.map((k) => k.id);
      const foreign = await m.query(
        'SELECT id FROM user_entity WHERE "keyDataId"=ANY($1::uuid[]) AND id<>$2 LIMIT 1',
        [ids, grant.accountId]
      );
      if (foreign.length) throw Error('AUTH_FINALIZATION_SHARED_KEY');
      await m.query(`UPDATE key_datum SET "${col}"=NULL WHERE "${col}"=$1`, [
        grant.accountId,
      ]);
      await m.query('DELETE FROM user_entity WHERE id=$1', [grant.accountId]);
      await m.query('DELETE FROM key_datum WHERE id=ANY($1::uuid[])', [ids]);
      const left = await m.query(
        `SELECT (SELECT count(*) FROM user_entity WHERE id=$1)+(SELECT count(*) FROM key_datum WHERE id=ANY($2::uuid[]) OR "${col}"=$1) AS n`,
        [grant.accountId, ids]
      );
      if (left?.length !== 1 || String(left[0].n) !== '0')
        throw Error('AUTH_FINALIZATION_READBACK');
      await this.authority.validateGrant(grant);
      // Account hash remains as the permanent operational exclusion marker, never a re-created identity.
      const progress = Object.fromEntries(
        Object.entries(operation.ownerProgress).filter(
          ([k]) => !k.startsWith('_')
        )
      );
      progress['_nonOrm'] = { verified: true, version: 1 };
      const done = await m.query(
        `WITH changed AS (UPDATE account_deletion_operations SET "accountId"=NULL,"privateScope"=NULL,"idempotencyKey"=$4,state='complete',"leaseOwner"=NULL,"leaseExpiresAt"=NULL,"ownerProgress"=$5::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND attempt=$2 AND "leaseOwner"=$3 AND "leaseExpiresAt">clock_timestamp() RETURNING id) SELECT id FROM changed`,
        [
          grant.operationId,
          grant.attempt,
          grant.leaseOwner,
          DELETED_ACCOUNT_ID,
          JSON.stringify(progress),
        ]
      );
      if (done.length !== 1) throw Error('AUTH_FINALIZATION_LEASE_STALE');
    });
    return this.authority.status(grant.operationId);
  }
}
