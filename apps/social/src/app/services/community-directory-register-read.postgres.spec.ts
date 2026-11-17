import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import staticDatabase from '../staticDatabase';
import { Community } from '../../entities/community.entity';
import { CommunityService } from './community.service';
import { beginRecovery, enableRegisterCapture } from './community-directory-epoch';
import { saveCommunityWithDirectoryChange } from './community-directory-outbox';
import { initializeDirectoryRegister } from './community-directory-register-initialize';
import { readDirectoryRegisterSnapshot, scanDirectoryRegister, readCurrentDirectoryRegister, readCurrentDirectoryGeography, scanDirectoryRegisterV2, readDirectoryRegisterSnapshotV2 } from './community-directory-register-read';

const marker = process.env.SOCIAL_REGISTER_READ_TEST;
if (marker !== undefined && marker !== 'disposable-s3social') throw new Error('Invalid disposable register read marker');
(marker === 'disposable-s3social' ? describe : describe.skip)('register reads on migrated Social database', () => {
  let db: DataSource;
  beforeAll(async () => {
    if (process.env.POSTGRES_HOST !== '127.0.0.1' || process.env.POSTGRES_DB !== 's3social') throw new Error('Disposable database required');
    db = await staticDatabase.initialize();
  });
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  it('limits scans, protects private and wrong-scope data, and rejects stale tokens', async () => {
    const repo = db.getRepository(Community);
    const suffix = randomUUID();
    const rows = await repo.save([
      repo.create({name:`public-${suffix}`,ownerId:'fixture',ownerProfileId:'fixture',appScope:'local-hub',localityType:'town',isPrivate:false}),
      repo.create({name:`private-${suffix}`,ownerId:'fixture',ownerProfileId:'fixture',appScope:'local-hub',localityType:'town',isPrivate:true}),
      repo.create({name:`other-${suffix}`,ownerId:'fixture',ownerProfileId:'fixture',appScope:'social',localityType:'town',isPrivate:false}),
      repo.create({name:`development-${suffix}`,ownerId:'fixture',ownerProfileId:'fixture',appScope:'local-hub',localityType:'town',isPrivate:false,adminArea:'Development fixture'}),
    ]);
    try {
      await beginRecovery(db); await initializeDirectoryRegister(db, true); await enableRegisterCapture(db, true);
      const [identity] = await db.query('SELECT "sourceEpoch", "activationId", "socialGeneration" FROM community_directory_epoch WHERE id=1');
      const {sourceEpoch} = identity;
      const fixtureCurrent = await db.transaction(m => readCurrentDirectoryRegister(m, identity, rows[3].id));
      expect(fixtureCurrent).toMatchObject({status:'current',snapshot:null});
      const page = await db.transaction(m => scanDirectoryRegister(m, sourceEpoch, null, 2));
      expect(page).toHaveLength(2);
      const entries = await db.query('SELECT "communityId", "changeToken" FROM community_directory_register WHERE "communityId"=ANY($1::uuid[])', [rows.map(r=>r.id)]);
      for (const [i, community] of rows.entries()) {
        const token = entries.find((e: any) => e.communityId === community.id).changeToken;
        const result = await db.transaction(m => readDirectoryRegisterSnapshot(m, sourceEpoch, community.id, token));
        expect(result.status).toBe('current');
        if (result.status === 'current') {
          if (i === 0) expect(result.snapshot).toMatchObject({id:community.id,name:community.name,appScope:'local-hub',isPrivate:false,localityType:'town'});
          else expect(result.snapshot).toBeNull();
        }
        expect(await db.transaction(m => readDirectoryRegisterSnapshot(m, sourceEpoch, community.id, randomUUID()))).toEqual({status:'superseded'});
      }
      await beginRecovery(db);
      await expect(db.transaction(m => scanDirectoryRegister(m, sourceEpoch, null, 10))).rejects.toThrow('authority');
    } finally {
      await db.query('DELETE FROM community_directory_register WHERE "communityId"=ANY($1::uuid[])', [rows.map(r=>r.id)]);
      await repo.delete(rows.map(r=>r.id));
      await db.query('DELETE FROM community_directory_epoch WHERE id=1');
    }
  });
  it('excludes only the explicit fixture marker from real census and snapshot SQL', async () => {
    const repo = db.getRepository(Community);
    const rows = await repo.save([
      repo.create({name:'fixture-census-normal',ownerId:'fixture',ownerProfileId:'fixture',appScope:'local-hub',localityType:'town',isPrivate:false,adminArea:null,isSystemCommunity:false}),
      repo.create({name:'fixture-census-marked',ownerId:'fixture',ownerProfileId:'fixture',appScope:'local-hub',localityType:'town',isPrivate:false,adminArea:'Development fixture',isSystemCommunity:false}),
    ]);
    try {
      const service = new CommunityService(repo, null as any, null as any, null as any, null as any, null as any, null as any);
      // Exercise the real SQL against this isolated database; authority is tested separately.
      (service as any).withDirectoryEpoch = (_epoch: string, read: any) => db.transaction(read);
      const sourceEpoch = randomUUID();
      const result = await service.findDirectoryCensus(sourceEpoch, undefined, 200);
      expect(result.communities.map(row => row.id)).toContain(rows[0].id);
      expect(result.communities.map(row => row.id)).not.toContain(rows[1].id);
      expect(await service.directorySnapshot(rows[0].id, sourceEpoch)).toMatchObject({id:rows[0].id});
      expect(await service.directorySnapshot(rows[1].id, sourceEpoch)).toBeNull();
    } finally { await repo.delete(rows.map(row => row.id)); }
  });

  it('reads geographic inputs only for currently eligible towns', async () => {
    const repo=db.getRepository(Community);
    const rows=await repo.save([
      repo.create({name:'geo-public',ownerId:'fixture',ownerProfileId:'fixture',appScope:'local-hub',localityType:'town',isPrivate:false,city:'Example',adminArea:'GA',countryCode:'US',lat:31.5,lng:-82.5}),
      repo.create({name:'geo-private',ownerId:'fixture',ownerProfileId:'fixture',appScope:'local-hub',localityType:'town',isPrivate:true,city:'Private',adminArea:'GA',countryCode:'US',lat:31.5,lng:-82.5}),
      repo.create({name:'geo-fixture',ownerId:'fixture',ownerProfileId:'fixture',appScope:'local-hub',localityType:'town',isPrivate:false,city:'Fixture',adminArea:'Development fixture',countryCode:'US',lat:31.5,lng:-82.5}),
    ]);
    try {
      await beginRecovery(db);await initializeDirectoryRegister(db,true);await enableRegisterCapture(db,true);
      const [identity]=await db.query('SELECT "sourceEpoch", "activationId", "socialGeneration" FROM community_directory_epoch WHERE id=1');
      expect(await db.transaction(m=>readCurrentDirectoryGeography(m,identity,rows[0].id))).toMatchObject({status:'current',geography:{communityId:rows[0].id,city:'Example',adminArea:'GA',countryCode:'US',localityType:'town',referencePoint:[-82.5,31.5]}});
      for(const row of rows.slice(1)) expect(await db.transaction(m=>readCurrentDirectoryGeography(m,identity,row.id))).toMatchObject({status:'current',geography:null});
      expect(await db.transaction(m=>readCurrentDirectoryGeography(m,identity,randomUUID()))).toEqual({status:'absent'});
    } finally {
      await db.query('DELETE FROM community_directory_register WHERE "communityId"=ANY($1::uuid[])',[rows.map(row=>row.id)]);await repo.delete(rows.map(row=>row.id));await db.query('DELETE FROM community_directory_epoch WHERE id=1');
    }
  });

  it('holds the Social authority lock until the read transaction ends', async () => {
    await beginRecovery(db); await initializeDirectoryRegister(db, true); await enableRegisterCapture(db, true);
    const [{sourceEpoch}] = await db.query('SELECT "sourceEpoch" FROM community_directory_epoch WHERE id=1');
    const reader = db.createQueryRunner(); await reader.connect(); await reader.startTransaction();
    try {
      await scanDirectoryRegister(reader.manager, sourceEpoch, null, 10);
      const [{pid}] = await reader.query('SELECT pg_backend_pid() AS pid');
      let done = false;
      const recovery = beginRecovery(db).then(() => { done = true; });
      try {
        let blocked = false;
        for (let i=0; i<50; i++) {
          const [state] = await db.query(`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid)) AND query LIKE '%community_directory_epoch%' ) AS blocked`, [pid]);
          if (state.blocked) { blocked=true; break; }
          await db.query('SELECT pg_sleep(0.02)');
        }
        expect(blocked).toBe(true); expect(done).toBe(false);
      } finally { await reader.commitTransaction(); await recovery; }
      await expect(db.transaction(m => scanDirectoryRegister(m, sourceEpoch, null, 10))).rejects.toThrow('authority');
    } finally {
      if (reader.isTransactionActive) await reader.rollbackTransaction();
      await reader.release(); await db.query('DELETE FROM community_directory_epoch WHERE id=1');
    }
  });

  it('bounds authority lock waits through the service RPC wrapper', async () => {
    await beginRecovery(db); await initializeDirectoryRegister(db, true); await enableRegisterCapture(db, true);
    const [{sourceEpoch}] = await db.query('SELECT "sourceEpoch" FROM community_directory_epoch WHERE id=1');
    const writer = db.createQueryRunner(); await writer.connect(); await writer.startTransaction();
    try {
      await writer.query('SELECT id FROM community_directory_epoch WHERE id=1 FOR UPDATE');
      const service = new CommunityService(db.getRepository(Community), null as any, null as any, null as any, null as any, null as any, null as any);
      await expect(service.scanDirectoryRegister(sourceEpoch, null, 10)).rejects.toMatchObject({driverError:{code:'55P03'}});
    } finally {
      if (writer.isTransactionActive) await writer.rollbackTransaction();
      await writer.release(); await db.query('DELETE FROM community_directory_epoch WHERE id=1');
    }
  }, 10000);

  it('supersedes a token after a real privacy mutation and exposes no private snapshot', async () => {
    const repo = db.getRepository(Community);
    const community = await repo.save(repo.create({name:`supersede-${randomUUID()}`,ownerId:'fixture',ownerProfileId:'fixture',appScope:'local-hub',localityType:'town',isPrivate:false}));
    const previous = process.env.SOCIAL_DIRECTORY_MODE;
    try {
      await beginRecovery(db); await initializeDirectoryRegister(db, true); await enableRegisterCapture(db, true);
      process.env.SOCIAL_DIRECTORY_MODE = 'register-only';
      const [{sourceEpoch}] = await db.query('SELECT "sourceEpoch" FROM community_directory_epoch WHERE id=1');
      const [before] = await db.query('SELECT "changeToken" FROM community_directory_register WHERE "communityId"=$1', [community.id]);
      await saveCommunityWithDirectoryChange(repo, {id:community.id, isPrivate:true} as Community);
      const [after] = await db.query('SELECT "changeToken" FROM community_directory_register WHERE "communityId"=$1', [community.id]);
      expect(after.changeToken).not.toBe(before.changeToken);
      expect(await db.transaction(m => readDirectoryRegisterSnapshot(m, sourceEpoch, community.id, before.changeToken))).toEqual({status:'superseded'});
      expect(await db.transaction(m => readDirectoryRegisterSnapshot(m, sourceEpoch, community.id, after.changeToken))).toEqual({status:'current',snapshot:null});
    } finally {
      if (previous === undefined) delete process.env.SOCIAL_DIRECTORY_MODE; else process.env.SOCIAL_DIRECTORY_MODE = previous;
      await db.query('DELETE FROM community_directory_register WHERE "communityId"=$1', [community.id]);
      await repo.delete(community.id); await db.query('DELETE FROM community_directory_epoch WHERE id=1');
    }
  });

  it('supersedes a token when a town becomes an explicitly marked development fixture', async () => {
    const repo = db.getRepository(Community);
    const community = await repo.save(repo.create({name:`supersede-${randomUUID()}`,ownerId:'fixture',ownerProfileId:'fixture',appScope:'local-hub',localityType:'town',isPrivate:false}));
    const previous = process.env.SOCIAL_DIRECTORY_MODE;
    try {
      await beginRecovery(db); await initializeDirectoryRegister(db, true); await enableRegisterCapture(db, true);
      process.env.SOCIAL_DIRECTORY_MODE = 'register-only';
      const [{sourceEpoch}] = await db.query('SELECT "sourceEpoch" FROM community_directory_epoch WHERE id=1');
      const [before] = await db.query('SELECT "changeToken" FROM community_directory_register WHERE "communityId"=$1', [community.id]);
      await saveCommunityWithDirectoryChange(repo, {id:community.id, adminArea:'Development fixture'} as Community);
      const [after] = await db.query('SELECT "changeToken" FROM community_directory_register WHERE "communityId"=$1', [community.id]);
      expect(after.changeToken).not.toBe(before.changeToken);
      expect(await db.transaction(m => readDirectoryRegisterSnapshot(m, sourceEpoch, community.id, before.changeToken))).toEqual({status:'superseded'});
      expect(await db.transaction(m => readDirectoryRegisterSnapshot(m, sourceEpoch, community.id, after.changeToken))).toEqual({status:'current',snapshot:null});
    } finally {
      if (previous === undefined) delete process.env.SOCIAL_DIRECTORY_MODE; else process.env.SOCIAL_DIRECTORY_MODE = previous;
      await db.query('DELETE FROM community_directory_register WHERE "communityId"=$1', [community.id]);
      await repo.delete(community.id); await db.query('DELETE FROM community_directory_epoch WHERE id=1');
    }
  });

  it('distinguishes current, absent and missing-register corruption under a full source incarnation', async () => {
    const repo = db.getRepository(Community);
    const row = await repo.save(repo.create({name:`current-${randomUUID()}`,ownerId:'fixture',ownerProfileId:'fixture',appScope:'local-hub',localityType:'town',isPrivate:false}));
    try {
      await beginRecovery(db); await initializeDirectoryRegister(db, true); await enableRegisterCapture(db, true);
      const [identity] = await db.query('SELECT "sourceEpoch", "activationId", "socialGeneration" FROM community_directory_epoch WHERE id=1');
      expect(await db.transaction(m => readCurrentDirectoryRegister(m, identity, row.id))).toMatchObject({status:'current',snapshot:{id:row.id}});
      const scan = await db.transaction(m => scanDirectoryRegisterV2(m, identity, null, 200));
      const item = scan.find(x => x.communityId === row.id)!;
      expect(await db.transaction(m => readDirectoryRegisterSnapshotV2(m, identity, row.id, item.changeToken))).toMatchObject({status:'current',snapshot:{id:row.id}});
      await expect(db.transaction(m => scanDirectoryRegisterV2(m, {...identity,socialGeneration:'999'}, null, 10))).rejects.toThrow('authority');
      expect(await db.transaction(m => readCurrentDirectoryRegister(m, identity, randomUUID()))).toEqual({status:'absent'});
      await db.query('DELETE FROM community_directory_register WHERE "communityId"=$1', [row.id]);
      await expect(db.transaction(m => readCurrentDirectoryRegister(m, identity, row.id))).rejects.toThrow('invariant');
      await expect(db.transaction(m => readCurrentDirectoryRegister(m, {...identity,activationId:randomUUID()}, row.id))).rejects.toThrow('authority');
    } finally { await db.query('DELETE FROM community_directory_register WHERE "communityId"=$1', [row.id]); await repo.delete(row.id); await db.query('DELETE FROM community_directory_epoch WHERE id=1'); }
  });

});
