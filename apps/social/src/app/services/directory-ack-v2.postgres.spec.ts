import { createHmac, randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import {
  acknowledgeDirectoryV2,
  deleteExactDirectoryAckV2,
} from './directory-ack-v2';
import { bindDirectoryEpochPair } from './community-directory-epoch';
import { signRecoveryProof } from '../../../../../libs/social/contracts/src/lib/directory-recovery-proof';

const dbTest =
  process.env.SOCIAL_ACK_TEST === 'disposable-postgis'
    ? describe
    : describe.skip;
dbTest('v2 ACK exact deletion on PostgreSQL', () => {
  let db: DataSource;
  const schema = `ack_test_${randomUUID().replace(/-/g, '')}`;
  const identity = {
    revision: '1',
    communityId: randomUUID(),
    eventNonce: randomUUID(),
    sourceEpoch: randomUUID(),
    recoveryEpoch: randomUUID(),
  };
  const transaction = <T>(fn: (m: EntityManager) => Promise<T>) =>
    db.transaction(async (m) => {
      await m.query(`SET LOCAL search_path TO "${schema}"`);
      return fn(m);
    });
  beforeAll(async () => {
    if (
      process.env.POSTGRES_HOST !== '127.0.0.1' ||
      process.env.POSTGRES_PORT !== '55439'
    )
      throw new Error('Disposable PostGIS required');
    db = new DataSource({
      type: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: 55439,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: 'postgres',
    });
    await db.initialize();
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.query(
      `CREATE TABLE "${schema}".community_directory_epoch (id integer PRIMARY KEY, "sourceEpoch" uuid NOT NULL, "directoryRecoveryEpoch" uuid, fenced boolean NOT NULL, phase varchar NOT NULL DEFAULT 'fenced', "activationId" uuid, owner uuid, "socialGeneration" bigint NOT NULL DEFAULT 0, "directoryGeneration" bigint, "updatedAt" timestamptz NOT NULL DEFAULT now())`
    );
    await db.query(
      `CREATE TABLE "${schema}".community_directory_change (revision bigint PRIMARY KEY, "communityId" uuid NOT NULL, "eventNonce" uuid, "sourceEpoch" uuid)`
    );
  });
  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.destroy();
    }
  });
  it('rejects collisions and null legacy identity, rolls back and handles concurrent retries', async () => {
    await transaction((m) =>
      m.query('INSERT INTO community_directory_change VALUES ($1,$2,$3,$4)', [
        identity.revision,
        identity.communityId,
        identity.eventNonce,
        identity.sourceEpoch,
      ])
    );
    for (const field of ['communityId', 'eventNonce', 'sourceEpoch'] as const)
      await expect(
        transaction((m) =>
          deleteExactDirectoryAckV2(m, { ...identity, [field]: randomUUID() })
        )
      ).rejects.toThrow();
    await expect(
      transaction(async (m) => {
        await deleteExactDirectoryAckV2(m, identity);
        throw new Error('rollback');
      })
    ).rejects.toThrow('rollback');
    await transaction((m) =>
      m.query('UPDATE community_directory_change SET "sourceEpoch" = NULL')
    );
    await expect(
      transaction((m) => deleteExactDirectoryAckV2(m, identity))
    ).rejects.toThrow();
    await transaction((m) =>
      m.query('UPDATE community_directory_change SET "sourceEpoch" = $1', [
        identity.sourceEpoch,
      ])
    );
    const results = await Promise.all([
      transaction((m) => deleteExactDirectoryAckV2(m, identity)),
      transaction((m) => deleteExactDirectoryAckV2(m, identity)),
    ]);
    expect(results.sort()).toEqual(['already-absent', 'deleted']);
    expect(
      await transaction((m) => deleteExactDirectoryAckV2(m, identity))
    ).toBe('already-absent');
  });
  it('serializes ACK with authority rotation and rejects stale or absent authority', async () => {
    const signing = 's'.repeat(32),
      transport = 't'.repeat(32);
    const sign = (v: typeof identity) =>
      createHmac('sha256', signing)
        .update(
          'directory-receipt-v2:' +
            [
              v.revision,
              v.communityId,
              v.eventNonce,
              v.sourceEpoch,
              v.recoveryEpoch,
            ]
              .map((x) => `${Buffer.byteLength(x)}:${x}`)
              .join('')
        )
        .digest('hex');
    await expect(
      transaction((m) =>
        acknowledgeDirectoryV2(m, identity, sign(identity), signing, transport)
      )
    ).rejects.toThrow();
    await transaction(async (m) => {
      await m.query(
        `INSERT INTO community_directory_epoch (id, "sourceEpoch", "directoryRecoveryEpoch", fenced, phase, "activationId", owner, "socialGeneration", "directoryGeneration") VALUES (1,$1,$2,false,'active',gen_random_uuid(),gen_random_uuid(),1,1)`,
        [identity.sourceEpoch, identity.recoveryEpoch]
      );
      await m.query(
        'INSERT INTO community_directory_change VALUES ($1,$2,$3,$4)',
        [
          identity.revision,
          identity.communityId,
          identity.eventNonce,
          identity.sourceEpoch,
        ]
      );
    });
    await expect(
      transaction((m) =>
        acknowledgeDirectoryV2(
          m,
          { ...identity, recoveryEpoch: randomUUID() },
          sign(identity),
          signing,
          transport
        )
      )
    ).rejects.toThrow();
    await expect(
      transaction((m) =>
        acknowledgeDirectoryV2(m, identity, 'v1', signing, transport)
      )
    ).rejects.toThrow();
    await expect(
      transaction(async (m) => {
        await acknowledgeDirectoryV2(
          m,
          identity,
          sign(identity),
          signing,
          transport
        );
        throw new Error('rollback');
      })
    ).rejects.toThrow('rollback');
    await transaction((m) =>
      m.query(
        "UPDATE community_directory_epoch SET fenced = true, phase = 'fenced' WHERE id = 1"
      )
    );
    let release!: () => void, locked!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const acquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const bindingDb = {
      transaction: (fn: any) =>
        transaction(async (m) => {
          const query = m.query.bind(m);
          m.query = (async (sql: string, params?: any[]) => {
            const result = await query(sql, params);
            if (sql.startsWith('UPDATE community_directory_epoch')) {
              locked();
              await gate;
            }
            return result;
          }) as any;
          return fn(m);
        }),
    } as DataSource;
    const recovery = {
      sourceEpoch: identity.sourceEpoch,
      recoveryEpoch: identity.recoveryEpoch,
      owner: randomUUID(),
    };
    const proofSecret = 'test-recovery-proof-secret-at-least-32-bytes';
    await transaction((m) =>
      m.query(
        'UPDATE community_directory_epoch SET "directoryRecoveryEpoch" = NULL WHERE id = 1'
      )
    );
    const binding = bindDirectoryEpochPair(
      bindingDb,
      recovery,
      signRecoveryProof(
        {
          ...recovery,
          activationId: randomUUID(),
          socialGeneration: '1',
          directoryGeneration: '1',
        },
        proofSecret
      ),
      proofSecret
    );
    try {
      await acquired;
      let settled = false;
      const ack = transaction((m) =>
        acknowledgeDirectoryV2(m, identity, sign(identity), signing, transport)
      ).finally(() => {
        settled = true;
      });
      await db.query('SELECT pg_sleep(0.1)');
      expect(settled).toBe(false);
      release();
      await binding;
      await expect(ack).rejects.toThrow();
      expect(
        await transaction((m) =>
          m.query('SELECT revision FROM community_directory_change')
        )
      ).toHaveLength(1);
    } finally {
      release();
      await binding;
    }
  });
});
