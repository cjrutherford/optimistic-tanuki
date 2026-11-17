import { createHmac, randomUUID } from 'node:crypto';
import { recordCommunityChange } from './community-directory-outbox';
import { acknowledgeDirectoryV2 } from './directory-ack-v2';
import { CommunityService } from './community.service';
import { DataSource } from 'typeorm';
import { SocialAuthoritySchema1793886775239 } from '../../../migrations/1793886775239-SocialAuthoritySchema';
import { activateSourceEpoch, bindDirectoryEpochPair } from './community-directory-epoch';
import { signRecoveryProof } from '../../../../../libs/social/contracts/src/lib/directory-recovery-proof';

(process.env.S3_AUTHORITY_TEST === 'disposable' ? describe : describe.skip)('Social authority schema on isolated PostGIS', () => {
  let db: DataSource;
  beforeAll(async () => {
    if (process.env.POSTGRES_HOST !== '127.0.0.1' || process.env.POSTGRES_PORT !== '55445' || process.env.POSTGRES_DB !== 'socialauthority') throw new Error('Disposable authority database required');
    db = new DataSource({ type: 'postgres', host: '127.0.0.1', port: 55445, username: 'postgres', password: 'disposable', database: 'socialauthority' });
    await db.initialize();
  });
  afterAll(async () => { await db?.destroy(); });
  it.each(['fresh', 'upgrade'])('%s rows default to fenced authority and preserve the outbox', async scenario => {
    const schema = `s3_authority_${randomUUID().replace(/-/g, '')}`;
    const runner = db.createQueryRunner();
    await runner.connect();
    try {
      await runner.query(`CREATE SCHEMA "${schema}"`);
      await runner.query(`SET search_path TO "${schema}", public`);
      await runner.query('CREATE TABLE community_directory_epoch (id integer PRIMARY KEY, "sourceEpoch" uuid NOT NULL, "directoryRecoveryEpoch" uuid, fenced boolean NOT NULL DEFAULT true, "initializedAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL)');
      await runner.query('CREATE TABLE community_directory_change (revision bigint PRIMARY KEY, "communityId" uuid NOT NULL)');
      const source = randomUUID(), community = randomUUID();
      if (scenario === 'upgrade') {
        await runner.query('INSERT INTO community_directory_epoch VALUES (1, $1, NULL, true, now(), now())', [source]);
        await runner.query('INSERT INTO community_directory_change VALUES (1, $1)', [community]);
      }
      const before = await runner.query('SELECT * FROM community_directory_change');
      await new SocialAuthoritySchema1793886775239().up(runner);
      if (scenario === 'fresh') await runner.query('INSERT INTO community_directory_epoch (id, "sourceEpoch", "initializedAt", "updatedAt") VALUES (1, $1, now(), now())', [source]);
      const [row] = await runner.query('SELECT * FROM community_directory_epoch');
      expect(row).toMatchObject({ fenced: true, phase: 'fenced', activationId: null, owner: null, socialGeneration: '0', directoryGeneration: null });
      expect(await runner.query('SELECT * FROM community_directory_change')).toEqual(before);
    } finally { await runner.query('SET search_path TO public'); await runner.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await runner.release(); }
  });
  it('rejects every live primitive after upgrading a formerly unfenced row without changing geometry', async () => {
    const schema = `s3_upgrade_${randomUUID().replace(/-/g, '')}`;
    const runner = db.createQueryRunner();
    await runner.connect();
    const previous = process.env.SOCIAL_DIRECTORY_MODE;
    try {
      await runner.query(`CREATE SCHEMA "${schema}"`);
      await runner.query(`SET search_path TO "${schema}", public`);
      await runner.query('CREATE TABLE community_directory_epoch (id integer PRIMARY KEY, "sourceEpoch" uuid NOT NULL, "directoryRecoveryEpoch" uuid, fenced boolean NOT NULL, "initializedAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL)');
      await runner.query('CREATE TABLE community_directory_change (revision bigint PRIMARY KEY, "communityId" uuid NOT NULL, "eventNonce" uuid, "sourceEpoch" uuid)');
      await runner.query('CREATE TABLE geometry_fixture (id integer PRIMARY KEY, geom geometry(Point, 4326))');
      await runner.query("INSERT INTO geometry_fixture VALUES (1, ST_SetSRID(ST_MakePoint(-73, 40), 4326))");
      const source = randomUUID(), recovery = randomUUID(), id = randomUUID(), nonce = randomUUID();
      await runner.query('INSERT INTO community_directory_epoch VALUES (1, $1, $2, false, now(), now())', [source, recovery]);
      await runner.query('INSERT INTO community_directory_change VALUES (1, $1, $2, $3)', [id, nonce, source]);
      const before = await runner.query('SELECT ST_AsEWKB(geom) AS geom FROM geometry_fixture');
      await new SocialAuthoritySchema1793886775239().up(runner);
      expect((await runner.query('SELECT fenced, phase FROM community_directory_epoch'))[0]).toEqual({ fenced: false, phase: 'fenced' });
      process.env.SOCIAL_DIRECTORY_MODE = 'active';
      const service = new CommunityService({ manager: { transaction: (fn: any) => fn(runner.manager) } } as any, null as any, null as any, null as any, null as any, null as any, null as any);
      await expect(recordCommunityChange(runner.manager, id, 'changed')).rejects.toThrow();
      await expect(service.directorySnapshot(id, source)).rejects.toThrow();
      await expect(service.directoryMembership('1', id, source, nonce)).rejects.toThrow();
      await expect(service.findDirectoryCensus(source)).rejects.toThrow();
      await expect(service.directoryUnread()).rejects.toThrow();
      await expect(service.findDirectoryEligible(id)).rejects.toThrow();
      const receipt = { revision: '1', communityId: id, eventNonce: nonce, sourceEpoch: source, recoveryEpoch: recovery };
      const signing = 's'.repeat(32);
      const signature = createHmac('sha256', signing).update('directory-receipt-v2:' + Object.values(receipt).map(value => `${Buffer.byteLength(value)}:${value}`).join('')).digest('hex');
      await expect(acknowledgeDirectoryV2(runner.manager, receipt, signature, signing, 't'.repeat(32))).rejects.toThrow('authority');
      expect(await runner.query('SELECT ST_AsEWKB(geom) AS geom FROM geometry_fixture')).toEqual(before);
      expect(await runner.query('SELECT revision FROM community_directory_change')).toHaveLength(1);
    } finally {
      if (previous === undefined) delete process.env.SOCIAL_DIRECTORY_MODE; else process.env.SOCIAL_DIRECTORY_MODE = previous;
      await runner.query('SET search_path TO public'); await runner.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await runner.release();
    }
  });
  it('rejects even a valid bound legacy proof without changing the outbox or fence', async () => {
    const sourceEpoch = randomUUID(), recoveryEpoch = randomUUID(), owner = randomUUID();
    const identity = { sourceEpoch, recoveryEpoch, owner }, secret = 'disposable-test-secret-at-least-32-bytes';
    const proof = signRecoveryProof({ ...identity, activationId: randomUUID(), socialGeneration: '1', directoryGeneration: '1' }, secret);
    await db.query('DELETE FROM community_directory_epoch');
    await db.query('INSERT INTO community_directory_epoch (id, "sourceEpoch", fenced, "initializedAt", "updatedAt") VALUES (1, $1, true, now(), now())', [sourceEpoch]);
    await expect(bindDirectoryEpochPair(db, identity, proof, secret)).rejects.toThrow('Legacy Social binding is disabled');
    const before = await db.query('SELECT * FROM community_directory_change ORDER BY revision');
    await expect(activateSourceEpoch(db, identity, proof, secret)).rejects.toThrow('Legacy Social activation is disabled');
    expect(await db.query('SELECT * FROM community_directory_change ORDER BY revision')).toEqual(before);
    expect((await db.query('SELECT fenced, phase FROM community_directory_epoch'))[0]).toEqual({ fenced: true, phase: 'fenced' });
  });
});
