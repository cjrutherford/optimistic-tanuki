import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { lockSocialRuntimeAuthority } from './social-authority';
import { acknowledgeDirectoryV2 } from './directory-ack-v2';
import { recordCommunityChange } from './community-directory-outbox';

(process.env.S3_RUNTIME_TEST === 'disposable' ? describe : describe.skip)('runtime authority on fully migrated Social', () => {
  let db: DataSource;
  const pair = { sourceEpoch: randomUUID(), recoveryEpoch: randomUUID() };
  const previousMode = process.env.SOCIAL_DIRECTORY_MODE;
  beforeAll(async () => {
    if (process.env.POSTGRES_HOST !== '127.0.0.1' || process.env.POSTGRES_DB !== 's3social') throw new Error('Disposable database required');
    db = new DataSource({ type: 'postgres', host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT), username: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });
    await db.initialize();
    await db.query(`INSERT INTO community_directory_epoch (id, "sourceEpoch", "directoryRecoveryEpoch", "activationId", owner, "socialGeneration", "directoryGeneration", phase, fenced, "preparedPayload", "initializedAt", "updatedAt") VALUES (1,$1,$2,$3,$4,1,1,'active',false,$5,now(),now())`, [pair.sourceEpoch, pair.recoveryEpoch, randomUUID(), randomUUID(), JSON.stringify({accepted:{version:'directory-enabled-v1',digest:'a'.repeat(64)}})]);
  });
  afterAll(async () => { if (previousMode === undefined) delete process.env.SOCIAL_DIRECTORY_MODE; else process.env.SOCIAL_DIRECTORY_MODE = previousMode; await db?.destroy(); });
  it('rejects missing peer proof on active writes and ACK, and rolls back', async () => {
    process.env.SOCIAL_DIRECTORY_MODE = 'active';
    await expect(db.transaction(async m => { await m.query('CREATE TEMP TABLE runtime_rollback (id int)'); await recordCommunityChange(m, randomUUID(), 'changed'); })).rejects.toThrow('authority unavailable');
    await expect(db.transaction(m => acknowledgeDirectoryV2(m, {}, '', 's'.repeat(32), 't'.repeat(32)))).rejects.toThrow('authority unavailable');
    expect(await db.query('SELECT * FROM community_directory_change')).toHaveLength(0);
  });
  it('locks against refence and rejects stale pair and legacy authority', async () => {
    const runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction();
    try {
      await lockSocialRuntimeAuthority(runner.manager, pair);
      let finished = false;
      const refence = db.query("UPDATE community_directory_epoch SET fenced=true, phase='fenced' WHERE id=1").then(() => { finished = true; });
      await db.query('SELECT pg_sleep(0.1)'); expect(finished).toBe(false);
      await runner.commitTransaction(); await refence;
      await expect(db.transaction(m => lockSocialRuntimeAuthority(m, pair))).rejects.toThrow();
      await db.query("UPDATE community_directory_epoch SET fenced=false, phase='active' WHERE id=1");
      await expect(db.transaction(m => lockSocialRuntimeAuthority(m, {...pair, recoveryEpoch: randomUUID()}))).rejects.toThrow();
      await db.query('UPDATE community_directory_epoch SET "preparedPayload"=NULL WHERE id=1');
      await expect(db.transaction(m => lockSocialRuntimeAuthority(m, pair))).rejects.toThrow();
    } finally { if (runner.isTransactionActive) await runner.rollbackTransaction(); await runner.release(); }
  });
});
