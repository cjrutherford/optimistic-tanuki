import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import staticDatabase from '../staticDatabase';
import { beginRecovery, enableRegisterCapture } from './community-directory-epoch';
import { initializeDirectoryRegister } from './community-directory-register-initialize';

const marker = process.env.SOCIAL_RESTART_TEST;
if (marker !== undefined && marker !== 'disposable-s3restart') throw new Error('Invalid disposable restart test marker');
(marker === 'disposable-s3restart' ? describe : describe.skip)('capture across independent processes', () => {
  let db: DataSource;
  const id = randomUUID();
  beforeAll(async () => {
    if (process.env.POSTGRES_HOST !== '127.0.0.1' || process.env.POSTGRES_DB !== 's3restart') throw new Error('Disposable database required');
    db = await staticDatabase.initialize();
    if ((await db.query('SELECT 1 FROM community_directory_epoch LIMIT 1')).length) throw new Error('Empty disposable authority required');
    await beginRecovery(db);
    await db.query(`INSERT INTO community_directory_change ("communityId", operation, "sourceEpoch") VALUES ($1,'deleted',NULL)`, [randomUUID()]);
    await initializeDirectoryRegister(db, true);
    await enableRegisterCapture(db, true);
  });
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  it('retains capture authorization and pending changes after the first process exits', async () => {
    const script = `const db=require('./src/app/staticDatabase').default;
      const {Community}=require('./src/entities/community.entity');
      const {saveCommunityWithDirectoryChange}=require('./src/app/services/community-directory-outbox');
      (async()=>{await db.initialize();try{const r=db.getRepository(Community);const id=process.env.RESTART_FIXTURE_ID;
      if(process.env.RESTART_FIXTURE_ACTION==='create') await saveCommunityWithDirectoryChange(r,r.create({id,name:'restart-fixture',ownerId:'fixture',ownerProfileId:'fixture',appScope:'local-hub',localityType:'town',isPrivate:false}));
      else {const row=await r.findOneByOrFail({id});if(row.isPrivate) throw new Error('unexpected state');await saveCommunityWithDirectoryChange(r,{id,isPrivate:true});}
      }finally{await db.destroy();}})().catch(()=>{process.stderr.write('fixture process failed');process.exitCode=1});`;
    const run = (action: string) => spawnSync(process.execPath, ['-r','ts-node/register','-r','tsconfig-paths/register','-e',script], {
      cwd: resolve('apps/social'), timeout: 45000, encoding:'utf8',
      env:{...process.env, TS_NODE_PROJECT:'tsconfig.app.json', TS_NODE_TRANSPILE_ONLY:'1', SOCIAL_DIRECTORY_MODE:'register-only', DIRECTORY_OUTBOX_MAX_EVENTS:'1', RESTART_FIXTURE_ID:id, RESTART_FIXTURE_ACTION:action},
    });
    const first = run('create'); expect(first.status).toBe(0);
    const [initial] = await db.query('SELECT "changeToken" FROM community_directory_register WHERE "communityId"=$1', [id]);
    const second = run('update'); expect(second.status).toBe(0);
    const [result] = await db.query(`SELECT c."isPrivate", r."changeToken", r.operation, r.dirty, (SELECT count(*)::int FROM community_directory_change) AS legacy FROM community c JOIN community_directory_register r ON r."communityId"=c.id WHERE c.id=$1`, [id]);
    expect(result).toMatchObject({isPrivate:true, operation:'changed', dirty:true, legacy:1});
    expect(result.changeToken).not.toBe(initial.changeToken);
  }, 100000);
});
