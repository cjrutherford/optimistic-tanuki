import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import staticDatabase from '../staticDatabase';
import { Community } from '../../entities/community.entity';
import { initializeDirectoryRegister } from './community-directory-register-initialize';

const marker = process.env.SOCIAL_REGISTER_INIT_TEST;
if (marker !== undefined && marker !== 'disposable-s3social') throw new Error('Invalid register test marker');
(marker === 'disposable-s3social' ? describe : describe.skip)('directory register initialization', () => {
  let db: DataSource;
  beforeAll(async () => {
    if (process.env.POSTGRES_HOST !== '127.0.0.1' || process.env.POSTGRES_DB !== 's3social') throw new Error('Disposable database required');
    db = await staticDatabase.initialize();
    await db.query(`INSERT INTO community_directory_epoch (id, "sourceEpoch", fenced, phase, "initializedAt", "updatedAt") VALUES (1,$1,true,'fenced',now(),now())`, [randomUUID()]);
  });
  afterAll(async () => { if (db?.isInitialized) { await db.query('DELETE FROM community_directory_epoch WHERE id=1'); await db.destroy(); } });
  it('adds current communities and legacy tombstones without rewriting existing records or legacy events', async () => {
    const repo = db.getRepository(Community);
    const existing = await repo.save(repo.create({name: `init-${randomUUID()}`, ownerId:'owner', ownerProfileId:'owner'}));
    const missing = randomUUID();
    const legacy = await db.query(`INSERT INTO community_directory_change ("communityId", operation, "sourceEpoch") VALUES ($1, 'changed', NULL), ($2, 'deleted', NULL) RETURNING revision`, [existing.id, missing]);
    try {
      await initializeDirectoryRegister(db, true);
      const first = await db.query('SELECT "communityId", "changeToken", operation, dirty FROM community_directory_register WHERE "communityId"=ANY($1::uuid[]) ORDER BY "communityId"', [[existing.id, missing]]);
      expect(first).toHaveLength(2);
      expect(first.find((r: any) => r.communityId === existing.id).operation).toBe('changed');
      expect(first.find((r: any) => r.communityId === missing).operation).toBe('deleted');
      await initializeDirectoryRegister(db, true);
      expect(await db.query('SELECT "communityId", "changeToken", operation, dirty FROM community_directory_register WHERE "communityId"=ANY($1::uuid[]) ORDER BY "communityId"', [[existing.id, missing]])).toEqual(first);
      expect(await db.query('SELECT revision FROM community_directory_change WHERE revision=ANY($1::bigint[]) ORDER BY revision', [legacy.map((r: any) => r.revision)])).toEqual(legacy);
    } finally {
      await db.query('DELETE FROM community_directory_register WHERE "communityId"=ANY($1::uuid[])', [[existing.id, missing]]);
      await db.query('DELETE FROM community_directory_change WHERE revision=ANY($1::bigint[])', [legacy.map((r: any) => r.revision)]);
      await repo.delete(existing.id);
    }
  });
  it('rejects contradictory existing records without modifying them', async () => {
    const id = randomUUID();
    await db.query(`INSERT INTO community_directory_register ("communityId", "changeToken", operation, dirty) VALUES ($1,$2,'changed',true)`, [id, randomUUID()]);
    try {
      await expect(initializeDirectoryRegister(db, true)).rejects.toThrow('contradictory');
      expect((await db.query('SELECT operation FROM community_directory_register WHERE "communityId"=$1', [id]))[0].operation).toBe('changed');
    } finally { await db.query('DELETE FROM community_directory_register WHERE "communityId"=$1', [id]); }
  });
  it('requires explicit external-fence confirmation', async () => {
    await expect(initializeDirectoryRegister(db, false)).rejects.toThrow('external fence');
  });
  it('rejects active authority and leaves a fenced authority fenced', async () => {
    await db.query(`UPDATE community_directory_epoch SET fenced=false, phase='active' WHERE id=1`);
    try {
      await expect(initializeDirectoryRegister(db, true)).rejects.toThrow('authority must be fenced');
      await db.query(`UPDATE community_directory_epoch SET fenced=true, phase='fenced' WHERE id=1`);
      await initializeDirectoryRegister(db, true);
      expect(await db.query('SELECT fenced, phase FROM community_directory_epoch WHERE id=1')).toEqual([{ fenced: true, phase: 'fenced' }]);
    } finally { await db.query(`UPDATE community_directory_epoch SET fenced=true, phase='fenced' WHERE id=1`); }
  });
  it('fails closed when a direct writer holds the community table', async () => {
    const writer = db.createQueryRunner();
    await writer.connect(); await writer.startTransaction();
    try {
      await writer.query('LOCK TABLE community IN ROW EXCLUSIVE MODE');
      await expect(initializeDirectoryRegister(db, true)).rejects.toThrow();
    } finally { await writer.rollbackTransaction(); await writer.release(); }
  }, 10000);

  it('rejects a missing authority row', async () => {
    const [row] = await db.query('SELECT "sourceEpoch" FROM community_directory_epoch WHERE id=1');
    await db.query('DELETE FROM community_directory_epoch WHERE id=1');
    try { await expect(initializeDirectoryRegister(db, true)).rejects.toThrow('authority must be fenced'); }
    finally { await db.query(`INSERT INTO community_directory_epoch (id, "sourceEpoch", fenced, phase, "initializedAt", "updatedAt") VALUES (1,$1,true,'fenced',now(),now())`, [row.sourceEpoch]); }
  });

  it('serializes competing initializers without changing the first baseline token', async () => {
    const repo = db.getRepository(Community);
    const community = await repo.save(repo.create({name: `init-race-${randomUUID()}`, ownerId:'owner', ownerProfileId:'owner'}));
    try {
      await Promise.all([initializeDirectoryRegister(db, true), initializeDirectoryRegister(db, true)]);
      const rows = await db.query('SELECT "changeToken", operation, dirty FROM community_directory_register WHERE "communityId"=$1', [community.id]);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({operation:'changed', dirty:true});
      await initializeDirectoryRegister(db, true);
      expect(await db.query('SELECT "changeToken", operation, dirty FROM community_directory_register WHERE "communityId"=$1', [community.id])).toEqual(rows);
    } finally { await db.query('DELETE FROM community_directory_register WHERE "communityId"=$1', [community.id]); await repo.delete(community.id); }
  });
  it('blocks a direct community writer while the baseline table locks are held', async () => {
    let release!: () => void, reportPid!: (pid: number) => void;
    const gate = new Promise<void>(r => { release = r; });
    const ready = new Promise<number>(r => { reportPid = r; });
    const wrapped = { transaction: (work: any) => db.transaction(async manager => {
      const [{ pid }] = await manager.query('SELECT pg_backend_pid() AS pid');
      const query = manager.query.bind(manager);
      manager.query = (async (sql: string, params?: any[]) => {
        const result = await query(sql, params);
        if (sql.startsWith('LOCK TABLE community,')) { reportPid(pid); await gate; }
        return result;
      }) as typeof manager.query;
      return work(manager);
    }) } as DataSource;
    const init = initializeDirectoryRegister(wrapped, true);
    const blocker = await ready;
    const writer = db.createQueryRunner();
    await writer.connect(); await writer.startTransaction();
    const [{pid}] = await writer.query('SELECT pg_backend_pid() AS pid');
    const attempt = writer.query('UPDATE community SET name=name WHERE false');
    try {
      let blocked = false;
      for (let n=0; n<50; n++) {
        const [state] = await db.query('SELECT $2::integer = ANY(pg_blocking_pids($1)) AS blocked', [pid, blocker]);
        if (state.blocked) { blocked = true; break; }
        await db.query('SELECT pg_sleep(0.02)');
      }
      expect(blocked).toBe(true);
    } finally { release(); await init; await attempt; await writer.rollbackTransaction(); await writer.release(); }
  });

});
