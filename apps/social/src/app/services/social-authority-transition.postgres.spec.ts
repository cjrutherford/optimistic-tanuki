import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { beginRecovery, bindSocialAuthority, prepareSocialAuthority } from './community-directory-epoch';
import { signRecoveryProof } from '../../../../../libs/social/contracts/src/lib/directory-recovery-proof';

(process.env.SOCIAL_TRANSITION_TEST === 'disposable' ? describe : describe.skip)('Social transition on disposable PostGIS', () => {
  let db: DataSource;
  const secret = 'disposable-secret-at-least-thirty-two-bytes';
  beforeAll(async () => {
    db = new DataSource({ type: 'postgres', host: '127.0.0.1', port: 55446, username: 'postgres', password: 'disposable', database: 'socialtransition' });
    await db.initialize();
    await db.query(`CREATE TABLE community_directory_epoch (id integer PRIMARY KEY, "sourceEpoch" uuid NOT NULL, "directoryRecoveryEpoch" uuid, fenced boolean NOT NULL, phase varchar NOT NULL, "activationId" uuid, owner uuid, "socialGeneration" bigint NOT NULL DEFAULT 0, "directoryGeneration" bigint, "preparedPayload" jsonb, "initializedAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL)`);
    await db.query('CREATE TABLE community_directory_change (revision bigint PRIMARY KEY, \"communityId\" uuid, operation varchar, \"sourceEpoch\" uuid, \"eventNonce\" uuid)');
  });
  afterAll(async () => { if (db?.isInitialized) { await db.query('DROP TABLE IF EXISTS community_directory_change, community_directory_epoch'); await db.destroy(); } });
  beforeEach(async () => { await db.query('DELETE FROM community_directory_change'); await db.query('DELETE FROM community_directory_epoch'); });
  async function identity() {
    const [row] = await db.query('SELECT * FROM community_directory_epoch');
    return { sourceEpoch: row.sourceEpoch, recoveryEpoch: randomUUID(), owner: randomUUID(), activationId: row.activationId, socialGeneration: row.socialGeneration, directoryGeneration: '1' };
  }
  const proof = (i: any) => signRecoveryProof(i, secret);
  it('retires once, rejects ABA and refence proofs, and preserves subsequent events on retry', async () => {
    await beginRecovery(db); const first = await identity();
    await db.query('INSERT INTO community_directory_change (revision) VALUES (1)');
    await bindSocialAuthority(db, first, proof(first), secret);
    await expect(prepareSocialAuthority(db, first, { ...proof(first), signature: '0'.repeat(64) }, secret)).rejects.toThrow();
    await expect(prepareSocialAuthority(db, { ...first, directoryGeneration: '2' }, proof(first), secret)).rejects.toThrow();
    expect(await db.query('SELECT * FROM community_directory_change')).toHaveLength(1);
    await prepareSocialAuthority(db, first, proof(first), secret);
    await db.query('INSERT INTO community_directory_change (revision) VALUES (2)');
    await prepareSocialAuthority(db, first, proof(first), secret);
    await beginRecovery(db); const second = await identity();
    expect(second.socialGeneration).toBe('2');
    expect(second.activationId).not.toBe(first.activationId);
    await expect(prepareSocialAuthority(db, first, proof(first), secret)).rejects.toThrow();
    expect(await db.query('SELECT revision FROM community_directory_change')).toEqual([{ revision: '2' }]);
    await bindSocialAuthority(db, second, proof(second), secret);
    await prepareSocialAuthority(db, second, proof(second), secret);
    expect(await db.query('SELECT * FROM community_directory_change')).toHaveLength(0);
  });
  it('rolls back deletion and phase together and rejects invalid phase', async () => {
    await beginRecovery(db); const i = await identity(); await bindSocialAuthority(db, i, proof(i), secret);
    await db.query('INSERT INTO community_directory_change (revision) VALUES (1)');
    await db.query(`CREATE FUNCTION fail_prepare() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase = 'prepared' THEN RAISE EXCEPTION 'test rollback'; END IF; RETURN NEW; END $$`);
    await db.query('CREATE TRIGGER fail_prepare BEFORE UPDATE ON community_directory_epoch FOR EACH ROW EXECUTE FUNCTION fail_prepare()');
    try { await expect(prepareSocialAuthority(db, i, proof(i), secret)).rejects.toThrow('test rollback'); }
    finally { await db.query('DROP TRIGGER fail_prepare ON community_directory_epoch'); await db.query('DROP FUNCTION fail_prepare()'); }
    expect(await db.query('SELECT * FROM community_directory_change')).toHaveLength(1);
    await db.query("UPDATE community_directory_epoch SET phase = 'invalid'");
    await expect(prepareSocialAuthority(db, i, proof(i), secret)).rejects.toThrow();
    await expect(beginRecovery(db)).rejects.toThrow();
    expect(await db.query('SELECT * FROM community_directory_change')).toHaveLength(1);
  });
  it('serializes competing prepares through the row lock', async () => {
    await beginRecovery(db); const i = await identity(); await bindSocialAuthority(db, i, proof(i), secret);
    await db.query('INSERT INTO community_directory_change (revision) VALUES (1)');
    const runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction();
    try {
      await runner.query('SELECT id FROM community_directory_epoch FOR UPDATE');
      let finished = false;
      const pending = prepareSocialAuthority(db, i, proof(i), secret).then(() => { finished = true; });
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(finished).toBe(false);
      await runner.commitTransaction(); await pending;
      expect((await db.query('SELECT phase, fenced FROM community_directory_epoch'))[0]).toEqual({ phase: 'prepared', fenced: true });
    } finally { if (runner.isTransactionActive) await runner.rollbackTransaction(); await runner.release(); }
  });
});
