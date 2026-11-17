import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const valid = (value: string) => typeof value === 'string' && uuid.test(value);

/** Obtain only the operator's blocked checkpoint; this does not certify recovery. */
export async function readRecoveryEpochs(db: Pick<DataSource, 'query'>): Promise<{ sourceEpoch: string; recoveryEpoch: string }> {
  const rows = await db.query(`SELECT p."sourceEpoch", p."recoveryEpoch", p.owner, p.phase, p.cursor, p.protocol, p."activationId", p."socialGeneration", p."directoryGeneration",
    i."recoveryEpoch" AS "authorityEpoch" FROM directory_census_progress p
    JOIN directory_installation i ON i.id = 'recovery-authority' WHERE p.id = 'recovery' FOR SHARE OF p, i`);
  const row = rows[0];
  if (rows.length !== 1 || !valid(row.sourceEpoch) || !valid(row.recoveryEpoch) || !valid(row.owner) || !valid(row.activationId) || !generation(row.socialGeneration) || !generation(row.directoryGeneration) || row.recoveryEpoch !== row.authorityEpoch || row.protocol !== 'legacy' || row.phase !== 'blocked' || row.cursor !== null) throw new Error('Invalid recovery authority');
  return { sourceEpoch: row.sourceEpoch, recoveryEpoch: row.recoveryEpoch };
}

type BeginRequest = { sourceEpoch: string; activationId: string; owner: string; socialGeneration: string };
const generation = (value: unknown): value is string => typeof value === 'string' && /^[1-9][0-9]*$/.test(value) && BigInt(value) <= 9223372036854775807n;

/** Operator only: fencing every old writer and serving process is an external prerequisite. */
export async function beginRecovery(db: DataSource, request: BeginRequest) {
  if (!request || ![request.sourceEpoch, request.activationId, request.owner].every(valid) || !generation(request.socialGeneration)) throw new Error('Invalid recovery identity');
  return db.transaction(async manager => {
    await manager.query("SELECT pg_advisory_xact_lock(hashtextextended('directory-recovery-authority-v1', 0))");
    const installations = await manager.query("SELECT * FROM directory_installation WHERE id='recovery-authority' FOR UPDATE");
    const checkpoints = await manager.query("SELECT * FROM directory_census_progress WHERE id='recovery' FOR UPDATE");
    if (installations.length !== checkpoints.length || installations.length > 1) throw new Error('Invalid legacy recovery authority');
    const old = checkpoints[0];
    if (old) {
      if (old.protocol !== 'legacy') throw new Error('Recovery protocol mismatch');
      if (![old.sourceEpoch, old.recoveryEpoch, old.activationId, old.owner].every(valid) || !generation(old.socialGeneration) || !generation(old.directoryGeneration) || installations[0].recoveryEpoch !== old.recoveryEpoch || !['blocked','social','directory','traversed','enabled'].includes(old.phase)) throw new Error('Invalid legacy recovery authority');
      if (old.sourceEpoch === request.sourceEpoch && old.activationId === request.activationId && old.owner === request.owner && old.socialGeneration === request.socialGeneration) {
        return {sourceEpoch: old.sourceEpoch, recoveryEpoch: old.recoveryEpoch, activationId: old.activationId, owner: old.owner, socialGeneration: old.socialGeneration, directoryGeneration: old.directoryGeneration, phase: old.phase, cursor: old.cursor};
      }
      if (old.sourceEpoch === request.sourceEpoch || old.activationId === request.activationId || BigInt(request.socialGeneration) <= BigInt(old.socialGeneration)) throw new Error('Stale recovery identity or owner');
      if (BigInt(old.directoryGeneration) === 9223372036854775807n) throw new Error('Directory generation exhausted');
    }
    const recoveryEpoch = randomUUID();
    const directoryGeneration = old ? (BigInt(old.directoryGeneration) + 1n).toString() : '1';
    await manager.query(`UPDATE directory_town SET "geometryStatus"='pending' WHERE "geometryStatus" <> 'pending'`);
    await manager.query(`UPDATE directory_provider_work SET status='blocked', "updatedAt"=CURRENT_TIMESTAMP`);
    await manager.query(`INSERT INTO directory_installation (id, "recoveryEpoch") VALUES ('recovery-authority',$1) ON CONFLICT (id) DO UPDATE SET "recoveryEpoch"=EXCLUDED."recoveryEpoch"`, [recoveryEpoch]);
    await manager.query(`INSERT INTO directory_census_progress (id, phase, cursor, "sourceEpoch", "recoveryEpoch", owner, "activationId", "socialGeneration", "directoryGeneration") VALUES ('recovery','blocked',NULL,$1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET phase='blocked', cursor=NULL, "sourceEpoch"=EXCLUDED."sourceEpoch", "recoveryEpoch"=EXCLUDED."recoveryEpoch", owner=EXCLUDED.owner, "activationId"=EXCLUDED."activationId", "socialGeneration"=EXCLUDED."socialGeneration", "directoryGeneration"=EXCLUDED."directoryGeneration", "enabledPayload"=NULL, "updatedAt"=CURRENT_TIMESTAMP`, [request.sourceEpoch,recoveryEpoch,request.owner,request.activationId,request.socialGeneration,directoryGeneration]);
    return {...request, recoveryEpoch, directoryGeneration, phase:'blocked', cursor:null};
  });
}

/** The legacy three-field entry point cannot establish authority. */
export async function initializeRecovery(_db: DataSource, _sourceEpoch: string, _owner: string): Promise<never> {
  throw new Error('Legacy recovery identity is not supported');
}

/** Read-only validation of the durable checkpoint; no takeover or completion is supported. */
export async function inspectRecovery(db: DataSource, sourceEpoch: string, recoveryEpoch: string, owner: string) {
  if (!valid(sourceEpoch) || !valid(recoveryEpoch)) throw new Error('Invalid recovery epoch');
  if (!valid(owner)) throw new Error('Invalid recovery owner');
  const rows = await db.query(`SELECT p."sourceEpoch", p."recoveryEpoch", p.owner, p.phase, p.cursor,
    i."recoveryEpoch" AS "authorityEpoch" FROM directory_census_progress p
    JOIN directory_installation i ON i.id = 'recovery-authority' WHERE p.id = 'recovery'`);
  if (rows.length !== 1 || !rows[0].recoveryEpoch || rows[0].recoveryEpoch !== rows[0].authorityEpoch || rows[0].recoveryEpoch !== recoveryEpoch || rows[0].sourceEpoch !== sourceEpoch) throw new Error('Recovery epoch mismatch or absent authority');
  if (rows[0].owner !== owner) throw new Error('Recovery owner mismatch');
  if (rows[0].phase !== 'blocked' || rows[0].cursor !== null) throw new Error('Unsafe recovery checkpoint');
  const { authorityEpoch, ...state } = rows[0];
  return state;
}
