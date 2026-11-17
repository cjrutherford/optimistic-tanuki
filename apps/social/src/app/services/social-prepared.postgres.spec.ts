import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyOperatorAttestation } from '../../../../../libs/social/contracts/src/lib/directory-operator-attestation';
import { DataSource } from 'typeorm';
import { beginRecovery, bindSocialAuthority, prepareSocialAuthority } from './community-directory-epoch';
import { signRecoveryProof } from '../../../../../libs/social/contracts/src/lib/directory-recovery-proof';

(process.env.SOCIAL_PREPARED_TEST === 'disposable' ? describe : describe.skip)('prepared authority on fully migrated Social database', () => {
  let db: DataSource;
  const secret = 'disposable-secret-at-least-thirty-two-bytes';
  beforeAll(async () => { db = new DataSource({ type: 'postgres', host: '127.0.0.1', port: 55447, username: 'postgres', password: 'disposable', database: 'socialprepared' }); await db.initialize(); });
  afterAll(async () => { await db?.destroy(); });
  it('rolls back retirement, then persists the same result on a post-commit retry without deleting later events', async () => {
    await db.query('DELETE FROM community_directory_change');
    await db.query('DELETE FROM community_directory_epoch');
    await beginRecovery(db);
    const [row] = await db.query('SELECT * FROM community_directory_epoch WHERE id = 1');
    const identity = { sourceEpoch: row.sourceEpoch, activationId: row.activationId, socialGeneration: row.socialGeneration, recoveryEpoch: randomUUID(), owner: randomUUID(), directoryGeneration: '1' };
    const proof = signRecoveryProof(identity, secret);
    await bindSocialAuthority(db, identity, proof, secret);
    await db.query(`INSERT INTO community_directory_change ("communityId", operation) VALUES ($1, 'changed')`, [randomUUID()]);
    await expect(prepareSocialAuthority(db, identity, { ...proof, signature: '0'.repeat(64) }, secret)).rejects.toThrow();
    await db.query(`CREATE FUNCTION fail_social_prepared_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase = 'prepared' THEN RAISE EXCEPTION 'rollback test'; END IF; RETURN NEW; END $$`);
    await db.query('CREATE TRIGGER fail_social_prepared_test BEFORE UPDATE ON community_directory_epoch FOR EACH ROW EXECUTE FUNCTION fail_social_prepared_test()');
    try { await expect(prepareSocialAuthority(db, identity, proof, secret)).rejects.toThrow('rollback test'); }
    finally { await db.query('DROP TRIGGER fail_social_prepared_test ON community_directory_epoch'); await db.query('DROP FUNCTION fail_social_prepared_test()'); }
    expect(await db.query('SELECT * FROM community_directory_change')).toHaveLength(1);
    const prepared = await prepareSocialAuthority(db, identity, proof, secret);
    expect(prepared).toMatchObject({ retirementCount: '1', version: 'social-traversal-v2' });
    expect(prepared.retirementDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(prepared.digest).toMatch(/^[0-9a-f]{64}$/);
    await db.query(`INSERT INTO community_directory_change ("communityId", operation) VALUES ($1, 'changed')`, [randomUUID()]);
    expect(await prepareSocialAuthority(db, identity, proof, secret)).toEqual(prepared);
    const wrong = { ...identity, directoryGeneration: '2' };
    await expect(prepareSocialAuthority(db, wrong, signRecoveryProof(wrong, secret), secret)).rejects.toThrow();
    expect(await db.query('SELECT * FROM community_directory_change')).toHaveLength(1);
  });
  it('signs only through the operator after commit and rejects a reused key without disclosing secrets', async () => {
    const [row] = await db.query('SELECT * FROM community_directory_epoch WHERE id = 1');
    const identity = { sourceEpoch: row.sourceEpoch, recoveryEpoch: row.directoryRecoveryEpoch, owner: row.owner, activationId: row.activationId, socialGeneration: row.socialGeneration, directoryGeneration: row.directoryGeneration };
    const proof = signRecoveryProof(identity, secret);
    const social = generateKeyPairSync('ed25519'), directory = generateKeyPairSync('ed25519');
    const dir = mkdtempSync(join(tmpdir(), 'social-prepared-'));
    try {
      const privatePem = social.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      const socialPublicKey = social.publicKey.export({ type: 'spki', format: 'pem' }).toString();
      const directoryPublicKey = directory.publicKey.export({ type: 'spki', format: 'pem' }).toString();
      writeFileSync(join(dir, 'private'), privatePem, { mode: 0o600 });
      writeFileSync(join(dir, 'social'), socialPublicKey); writeFileSync(join(dir, 'directory'), directoryPublicKey);
      const env = { ...process.env, TS_NODE_PROJECT: 'tsconfig.app.json', POSTGRES_HOST: '127.0.0.1', POSTGRES_PORT: '55447', POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: 'disposable', POSTGRES_DB: 'socialprepared', DIRECTORY_RECOVERY_PROOF_SECRET: secret, SOCIAL_OPERATOR_PRIVATE_KEY_FILE: join(dir, 'private'), SOCIAL_OPERATOR_PUBLIC_KEY_FILE: join(dir, 'social'), DIRECTORY_OPERATOR_PUBLIC_KEY_FILE: join(dir, 'directory'), SOCIAL_OPERATOR_KEY_ID: 'social', DIRECTORY_OPERATOR_KEY_ID: 'directory' };
      const invoke = (extra: Record<string, string>) => spawnSync(process.execPath, ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', 'src/source-epoch-operator.ts', 'prepare', '--confirm-external-fence', ...Object.values(identity)], { cwd: resolve('apps/social'), env: { ...env, ...extra }, input: JSON.stringify(proof), encoding: 'utf8', timeout: 30000 });
      const bad = invoke({ DIRECTORY_OPERATOR_PUBLIC_KEY_FILE: join(dir, 'social') });
      expect(bad.status).not.toBe(0);
      expect(bad.stdout + bad.stderr).not.toContain(privatePem);
      const good = invoke({});
      expect(good.status).toBe(0); expect(good.stderr).not.toContain(privatePem); expect(good.stderr).not.toContain(secret);
      expect(good.stdout).not.toContain(privatePem); expect(good.stdout).not.toContain(secret);
      const result = JSON.parse(good.stdout);
      expect(result.prepared).toEqual(row.preparedPayload);
      verifyOperatorAttestation(result.attestation, 'social-prepared', identity, { version: result.prepared.version, digest: result.prepared.digest }, { socialPublicKey, directoryPublicKey, socialKeyId: 'social', directoryKeyId: 'directory' });
      expect(await db.query('SELECT * FROM community_directory_change')).toHaveLength(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 70000);

});
