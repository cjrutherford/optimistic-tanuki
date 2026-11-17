import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { beginRecovery, bindSocialAuthority, prepareSocialAuthority } from './community-directory-epoch';
import { signRecoveryProof } from '../../../../../libs/social/contracts/src/lib/directory-recovery-proof';

const url = process.env.SOCIAL_PROOF_TEST_DATABASE_URL;
const secret = 'disposable-proof-secret-at-least-thirty-two-bytes';
(url ? describe : describe.skip)('Social six-field proof on migrated disposable PostGIS', () => {
  let db: DataSource;
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== '127.0.0.1' || parsed.pathname !== '/social_proof_test') throw new Error('Dedicated local social_proof_test database required');
    db = new DataSource({ type: 'postgres', url }); await db.initialize();
  });
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
    await db.query('DELETE FROM community_directory_change');
    await db.query('DELETE FROM community_directory_epoch');
  });
  const changes = () => ({ sourceEpoch: randomUUID(), recoveryEpoch: randomUUID(), owner: randomUUID(), activationId: randomUUID(), socialGeneration: '2', directoryGeneration: '2' });
  for (const operation of ['bind', 'prepare'] as const) {
    for (const field of ['sourceEpoch', 'recoveryEpoch', 'owner', 'activationId', 'socialGeneration', 'directoryGeneration'] as const) {
      it(`${operation} rejects a swapped ${field} in identity and proof`, async () => {
        await beginRecovery(db);
        const [row] = await db.query('SELECT * FROM community_directory_epoch WHERE id = 1');
        const identity = { sourceEpoch: row.sourceEpoch, recoveryEpoch: randomUUID(), owner: randomUUID(), activationId: row.activationId, socialGeneration: row.socialGeneration, directoryGeneration: '1' };
        const proof = signRecoveryProof(identity, secret);
        await db.query(`INSERT INTO community_directory_change ("communityId", operation) VALUES ($1, 'upsert')`, [randomUUID()]);
        const baseline = await db.query('SELECT revision, "communityId", operation FROM community_directory_change');
        if (operation === 'prepare') await bindSocialAuthority(db, identity, proof, secret);
        const invoke = operation === 'bind' ? bindSocialAuthority : prepareSocialAuthority;
        const value = changes()[field];
        await expect(invoke(db, { ...identity, [field]: value }, proof, secret)).rejects.toThrow();
        await expect(invoke(db, identity, { ...proof, [field]: value }, secret)).rejects.toThrow();
        if (operation === 'prepare' || ['sourceEpoch', 'activationId', 'socialGeneration'].includes(field)) {
          await expect(invoke(db, { ...identity, [field]: value }, signRecoveryProof({ ...identity, [field]: value }, secret), secret)).rejects.toThrow();
        }
        expect(await db.query('SELECT revision, "communityId", operation FROM community_directory_change')).toEqual(baseline);
        const [after] = await db.query('SELECT fenced, phase FROM community_directory_epoch WHERE id = 1');
        expect(after).toEqual({ fenced: true, phase: 'fenced' });
      });
    }
    it.each([
      ['legacy version', (p: any) => ({ ...p, traversal: 'social-then-directory-v1' })],
      ['malformed version', (p: any) => ({ ...p, traversal: null })],
      ['legacy shape', (p: any) => ({ sourceEpoch: p.sourceEpoch, recoveryEpoch: p.recoveryEpoch, owner: p.owner, signature: p.signature })],
      ['forged signature', (p: any) => ({ ...p, signature: '0'.repeat(64) })],
    ])(`${operation} rejects %s and preserves the baseline fence`, async (_name, mutate) => {
      await beginRecovery(db);
      const [row] = await db.query('SELECT * FROM community_directory_epoch WHERE id = 1');
      const identity = { sourceEpoch: row.sourceEpoch, recoveryEpoch: randomUUID(), owner: randomUUID(), activationId: row.activationId, socialGeneration: row.socialGeneration, directoryGeneration: '1' };
      const proof = signRecoveryProof(identity, secret);
      await db.query(`INSERT INTO community_directory_change ("communityId", operation) VALUES ($1, 'upsert')`, [randomUUID()]);
      const baseline = await db.query('SELECT revision, "communityId", operation FROM community_directory_change');
      if (operation === 'prepare') await bindSocialAuthority(db, identity, proof, secret);
      await expect((operation === 'bind' ? bindSocialAuthority : prepareSocialAuthority)(db, identity, mutate(proof), secret)).rejects.toThrow();
      expect(await db.query('SELECT revision, "communityId", operation FROM community_directory_change')).toEqual(baseline);
      expect((await db.query('SELECT fenced, phase FROM community_directory_epoch WHERE id = 1'))[0]).toEqual({ fenced: true, phase: 'fenced' });
    });
  }
});
