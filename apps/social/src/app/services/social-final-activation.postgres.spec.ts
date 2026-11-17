import { DataSource } from 'typeorm';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { activateSocial } from './social-final-activation';
import { prepareSocialAuthority } from './community-directory-epoch';
import { signRecoveryProof } from '../../../../../libs/social/contracts/src/lib/directory-recovery-proof';
import { signOperatorAttestation } from '../../../../../libs/social/contracts/src/lib/directory-operator-attestation';
import { enableDirectory } from '../../../../directory/src/directory-enabled';

(process.env.S3_FINAL_TEST === 'disposable' ? describe : describe.skip)('final Social activation on fully migrated stores', () => {
  let social: DataSource, directory: DataSource;
  beforeAll(async () => {
    social = new DataSource({type:'postgres', url:process.env.S3_SOCIAL_TEST_URL});
    directory = new DataSource({type:'postgres', url:process.env.S3_DIRECTORY_TEST_URL});
    await social.initialize(); await directory.initialize();
  });
  afterAll(async () => { await social?.destroy(); await directory?.destroy(); });
  it('rejects stale and forged proof, rolls back, serializes activation and preserves events on retry', async () => {
    const id = {sourceEpoch:randomUUID(), recoveryEpoch:randomUUID(), owner:randomUUID(), activationId:randomUUID(), socialGeneration:'1', directoryGeneration:'1'};
    await social.query(`INSERT INTO community_directory_epoch (id,"sourceEpoch","directoryRecoveryEpoch",owner,"activationId","socialGeneration","directoryGeneration",phase,fenced,"initializedAt","updatedAt") VALUES (1,$1,$2,$3,$4,$5,$6,'fenced',true,now(),now())`, Object.values(id));
    await directory.query(`INSERT INTO directory_installation (id,"recoveryEpoch") VALUES ('recovery-authority',$1)`, [id.recoveryEpoch]);
    await directory.query(`INSERT INTO directory_census_progress (id,phase,"sourceEpoch","recoveryEpoch",owner,"activationId","socialGeneration","directoryGeneration") VALUES ('recovery','traversed',$1,$2,$3,$4,$5,$6)`, Object.values(id));
    const secret = 'disposable-secret-at-least-thirty-two-bytes';
    const p = await prepareSocialAuthority(social,id,signRecoveryProof(id,secret),secret);
    const sk = generateKeyPairSync('ed25519'), dk = generateKeyPairSync('ed25519');
    const keys = {socialPublicKey:sk.publicKey,directoryPublicKey:dk.publicKey,socialKeyId:'social',directoryKeyId:'directory'};
    const prepared = signOperatorAttestation('social-prepared',id,{version:p.version,digest:p.digest},sk.privateKey,keys);
    const result = await enableDirectory(social,directory,id,prepared,keys,true);
    const enabled = signOperatorAttestation('directory-enabled',id,{version:'social-prepared-v1',digest:result.preparedDigest},dk.privateKey,keys);
    const run = (e = enabled, k = keys) => activateSocial(social,directory,id,prepared,e,k,true);
    await expect(activateSocial(social,directory,id,prepared,enabled,keys,false)).rejects.toThrow();
    for (const field of ['sourceEpoch','recoveryEpoch','owner','activationId','socialGeneration','directoryGeneration']) await expect(activateSocial(social,directory,{...id,[field]:field.endsWith('Generation')?'2':randomUUID()},prepared,enabled,keys,true)).rejects.toThrow();
    for (const bad of [{...enabled,signature:'A'.repeat(86)}, {...enabled,purpose:'social-prepared'}, {...enabled,issuer:'social'}, {...enabled,audience:'directory'}, {...enabled,keyId:'bad'}]) await expect(run(bad as typeof enabled)).rejects.toThrow();
    await expect(run(enabled,{...keys,directoryPublicKey:sk.publicKey})).rejects.toThrow();
    await expect(activateSocial(social,directory,id,{...prepared,signature:'A'.repeat(86)},enabled,keys,true)).rejects.toThrow();
    const changer = directory.createQueryRunner(); await changer.connect(); await changer.startTransaction();
    await changer.query(`UPDATE directory_census_progress SET phase='blocked' WHERE id='recovery'`);
    const stale = run();
    await changer.commitTransaction(); await changer.release();
    await expect(stale).rejects.toThrow();
    await directory.query(`UPDATE directory_census_progress SET phase='enabled' WHERE id='recovery'`);
    await social.query(`CREATE FUNCTION s3_fail_final() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='active' THEN RAISE EXCEPTION 'crash'; END IF; RETURN NEW; END $$`);
    await social.query('CREATE TRIGGER s3_fail_final BEFORE UPDATE ON community_directory_epoch FOR EACH ROW EXECUTE FUNCTION s3_fail_final()');
    try { await expect(run()).rejects.toThrow('crash'); } finally { await social.query('DROP TRIGGER s3_fail_final ON community_directory_epoch'); await social.query('DROP FUNCTION s3_fail_final()'); }
    expect((await social.query('SELECT phase,fenced FROM community_directory_epoch'))[0]).toEqual({phase:'prepared',fenced:true});
    await social.query(`INSERT INTO community_directory_change ("communityId",operation) VALUES ($1,'changed')`,[randomUUID()]);
    expect((await Promise.all([run(),run()])).sort()).toEqual(['active','already-active']);
    const before = (await social.query('SELECT * FROM community_directory_epoch'))[0];
    expect(await run()).toBe('already-active');
    expect((await social.query('SELECT * FROM community_directory_epoch'))[0]).toEqual(before);
    expect(await social.query('SELECT * FROM community_directory_change')).toHaveLength(1);
    await social.query(`UPDATE community_directory_epoch SET "preparedPayload"=NULL WHERE id=1`);
    await expect(run()).rejects.toThrow();
    await social.query(`UPDATE community_directory_epoch SET "preparedPayload"=$1::jsonb WHERE id=1`, [JSON.stringify(before.preparedPayload)]);
    const dir = mkdtempSync(join(tmpdir(), 's3-final-'));
    try {
      writeFileSync(join(dir,'social'), sk.publicKey.export({type:'spki',format:'pem'}));
      writeFileSync(join(dir,'directory'), dk.publicKey.export({type:'spki',format:'pem'}));
      const env = {...process.env, TS_NODE_PROJECT:'apps/social/tsconfig.app.json', SOCIAL_DATABASE_URL:process.env.S3_SOCIAL_TEST_URL, DIRECTORY_DATABASE_URL:process.env.S3_DIRECTORY_TEST_URL, SOCIAL_OPERATOR_PUBLIC_KEY_FILE:join(dir,'social'), DIRECTORY_OPERATOR_PUBLIC_KEY_FILE:join(dir,'directory'), SOCIAL_OPERATOR_KEY_ID:'social', DIRECTORY_OPERATOR_KEY_ID:'directory', DIRECTORY_RECOVERY_PROOF_SECRET:secret};
      const invoke = (flag: string) => spawnSync(process.execPath,['-r','ts-node/register/transpile-only','-r','tsconfig-paths/register','apps/social/src/source-epoch-operator.ts','activate-final',flag,...Object.values(id)],{cwd:resolve('.'), env, input:JSON.stringify({prepared,enabled}), encoding:'utf8',timeout:15000});
      const bad = invoke('--no-fence'), good = invoke('--confirm-external-fence');
      expect(bad.status).not.toBe(0); expect(good.status).toBe(0);
      expect(JSON.parse(good.stdout)).toEqual({result:'already-active'});
      expect(bad.stdout + bad.stderr + good.stdout + good.stderr).not.toContain(secret);
      expect(bad.stdout + bad.stderr + good.stdout + good.stderr).not.toContain('disposable@');
    } finally { rmSync(dir,{recursive:true,force:true}); }
    await directory.query(`UPDATE directory_census_progress SET "enabledPayload"=NULL WHERE id='recovery'`);
    await expect(run()).rejects.toThrow();
  }, 30000);
});
