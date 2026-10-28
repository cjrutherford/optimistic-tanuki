import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AccountDeletionAuthorityService } from './account-deletion-authority.service';
import { AccountDeletionOperationEntity } from './account-deletion-operation.entity';
import { AccountDeletionFenceService } from './account-deletion-fence.service';

const enabled = process.env['D00_PRIVATE_FIXTURE'] === 'd00-private-fixture';
(enabled ? describe : describe.skip)(
  'D00 authority on fresh migrated PostgreSQL',
  () => {
    let db: DataSource;
    const account = randomUUID();
    const counterpart = randomUUID();
    let operationId: string;
    const previousKey = process.env['ACCOUNT_DELETION_PROOF_KEY'];
    beforeAll(async () => {
      process.env['ACCOUNT_DELETION_PROOF_KEY'] = randomUUID() + randomUUID();
      db = new DataSource({
        type: 'postgres',
        host: process.env['POSTGRES_HOST'],
        port: Number(process.env['POSTGRES_PORT']),
        username: process.env['POSTGRES_USER'],
        password: process.env['POSTGRES_PASSWORD'],
        database: process.env['POSTGRES_DB'],
        entities: [AccountDeletionOperationEntity],
        synchronize: false,
        migrationsRun: false,
        extra: { statement_timeout: 5000, lock_timeout: 3000 },
      });
      await db.initialize();
    });
    afterAll(async () => {
      if (db?.isInitialized) {
        await db.transaction(async (manager) => {
          await manager.query(
            "SELECT set_config('ot.deletion_operation', $1, true)",
            [operationId]
          );
          await manager.query(
            'DELETE FROM token WHERE "userId"=ANY($1::uuid[])',
            [[account, counterpart]]
          );
          await manager.query(
            'DELETE FROM user_entity WHERE id=ANY($1::uuid[])',
            [[account, counterpart]]
          );
        });
        await db.query(
          'DELETE FROM account_deletion_write_fence WHERE "operationId"=$1',
          [operationId]
        );
        await db.query('DELETE FROM account_deletion_operations WHERE id=$1', [
          operationId,
        ]);
        expect(
          await db.query(
            'SELECT count(*)::int AS count FROM account_deletion_operations'
          )
        ).toEqual([{ count: 0 }]);
        await db.destroy();
      }
      if (previousKey === undefined)
        delete process.env['ACCOUNT_DELETION_PROOF_KEY'];
      else process.env['ACCOUNT_DELETION_PROOF_KEY'] = previousKey;
    });
    it('keeps a permanent account fence and recovers a lease without a user session', async () => {
      const repository = db.getRepository(AccountDeletionOperationEntity);
      const authority = new AccountDeletionAuthorityService(repository, db);
      const fence = new AccountDeletionFenceService(repository);
      await db.query(
        "INSERT INTO user_entity (id,email,\"firstName\",\"lastName\",password,bio) VALUES ($1,$2,'D00','Fixture','fixture-only',''),($3,$4,'Other','Fixture','fixture-only','')",
        [
          account,
          account + '@example.invalid',
          counterpart,
          counterpart + '@example.invalid',
        ]
      );
      await db.query(
        'INSERT INTO token (id,"tokenData","userId",revoked) VALUES ($1,$2,$3,false),($4,$5,$6,false)',
        [
          randomUUID(),
          'old-session-fixture',
          account,
          randomUUID(),
          'counterpart-session-fixture',
          counterpart,
        ]
      );
      const [first, second] = await Promise.all([
        authority.accept(account, 'client-interface', randomUUID()),
        authority.accept(account, 'local-hub', randomUUID()),
      ]);
      expect(first.id).toBe(second.id);
      operationId = first.id;
      const tokens = await db.query(
        'SELECT "userId",revoked FROM token WHERE "userId"=ANY($1::uuid[])',
        [[account, counterpart]]
      );
      expect(tokens).toEqual(
        expect.arrayContaining([
          { userId: account, revoked: true },
          { userId: counterpart, revoked: false },
        ])
      );
      await expect(
        db.query('UPDATE user_entity SET password=$1 WHERE id=$2', [
          'late-change',
          account,
        ])
      ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
      await expect(
        db.query(
          'INSERT INTO token (id,"tokenData","userId",revoked) VALUES ($1,$2,$3,false)',
          [randomUUID(), 'late-token-fixture', account]
        )
      ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
      await db.query('UPDATE user_entity SET password=$1 WHERE id=$2', [
        'other-change',
        counterpart,
      ]);
      await expect(fence.assertActiveAccount(account)).rejects.toThrow(
        'ACCOUNT_DELETION_FENCED'
      );
      await expect(
        fence.assertActiveAccount(counterpart)
      ).resolves.toBeUndefined();
      await authority.claim(operationId);
      const old = await authority.issueGrant(operationId, 'profile', 'fence');
      await expect(authority.claim(operationId)).rejects.toThrow(
        'ACCOUNT_DELETION_LEASE_ACTIVE'
      );
      const scope = {
        currentProfileIds: [randomUUID()],
        legacyProfileIds: ['legacy-fixture'],
      };
      await authority.recordProfileScope(old, scope);
      await authority.acknowledge(old);
      // Simulate a dead process's expired lease in the private fixture, then construct a fresh service.
      await db.query(
        'UPDATE account_deletion_operations SET "leaseExpiresAt"=CURRENT_TIMESTAMP-INTERVAL \'1 second\' WHERE id=$1',
        [operationId]
      );
      const restarted = new AccountDeletionAuthorityService(repository, db);
      await restarted.claim(operationId);
      await expect(restarted.validateGrant(old)).rejects.toThrow(
        'ACCOUNT_DELETION_GRANT_STALE'
      );
      const current = await restarted.issueGrant(
        operationId,
        'assets',
        'fence'
      );
      expect((await restarted.validateGrant(current)).scope).toEqual(scope);
      await expect(
        restarted.issueGrant(operationId, 'assets', 'erase')
      ).rejects.toThrow('ACCOUNT_DELETION_FENCES_PENDING');
      const status = await restarted.status(operationId);
      expect(JSON.stringify(status)).not.toContain(account);
      expect(status.state).toBe('fencing');
      await db.query(
        'UPDATE account_deletion_operations SET state=\'complete\', "accountId"=NULL WHERE id=$1',
        [operationId]
      );
      await expect(fence.assertActiveAccount(account)).rejects.toThrow(
        'ACCOUNT_DELETION_FENCED'
      );
      expect(
        (await restarted.accept(account, 'local-hub', randomUUID())).id
      ).toBe(operationId);
    });
  }
);
