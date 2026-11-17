import { DataSource, EntityManager } from 'typeorm';
import { DirectoryRecoveryIdentity } from './register-recovery-authority';

export type RegisterSweepCheckpoint = { generation: string; phase: 'census' | 'source' | 'directory' | 'complete'; cursor: string | null };
type Sweep = RegisterSweepCheckpoint & { previousGeneration: string | null; lastTransition: { expected: RegisterSweepCheckpoint; next: RegisterSweepCheckpoint } | null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const max = 9223372036854775807n;
const generation = (v: unknown): v is string => typeof v === 'string' && /^[1-9][0-9]*$/.test(v) && BigInt(v) <= max;
const fields: (keyof DirectoryRecoveryIdentity)[] = ['sourceEpoch','activationId','socialGeneration','recoveryEpoch','owner','directoryGeneration'];
const validIdentity = (id: DirectoryRecoveryIdentity) => !!id && [id.sourceEpoch,id.activationId,id.recoveryEpoch,id.owner].every(v => typeof v === 'string' && uuid.test(v)) && generation(id.socialGeneration) && generation(id.directoryGeneration);
const validCheckpoint = (c: RegisterSweepCheckpoint) => !!c && generation(c.generation) && ['census','source','directory','complete'].includes(c.phase) && (c.cursor === null || (typeof c.cursor === 'string' && uuid.test(c.cursor))) && (c.phase !== 'complete' || c.cursor === null);
const same = (a: RegisterSweepCheckpoint, b: RegisterSweepCheckpoint) => a.generation === b.generation && a.phase === b.phase && a.cursor === b.cursor;
const checkpoint = (s: Sweep): RegisterSweepCheckpoint => ({generation:s.generation,phase:s.phase,cursor:s.cursor});

async function lock(manager: EntityManager, id: DirectoryRecoveryIdentity): Promise<Sweep | null> {
  if (!validIdentity(id)) throw Error('Invalid recovery authority');
  await manager.query("SET LOCAL lock_timeout = '2s'");
  await manager.query("SELECT pg_advisory_xact_lock(hashtextextended('directory-recovery-authority-v1', 0))");
  const installations = await manager.query("SELECT * FROM directory_installation WHERE id='recovery-authority' FOR UPDATE");
  const rows = await manager.query("SELECT * FROM directory_census_progress WHERE id='recovery' FOR UPDATE");
  const p = rows[0];
  if (installations.length !== 1 || rows.length !== 1 || p.protocol !== 'register-pending-v1' || p.phase !== 'reg-running' || installations[0].recoveryEpoch !== id.recoveryEpoch || fields.some(k => p[k] !== id[k])) throw Error('Recovery authority mismatch');
  if (!p.registerRequest || typeof p.registerRequest !== 'object' || Array.isArray(p.registerRequest) || ['sourceEpoch','activationId','socialGeneration','owner'].some(k => p.registerRequest[k] !== id[k])) throw Error('Invalid sweep authority');
  const sweep = p.registerRequest?.sweep;
  if (sweep === undefined) return null;
  if (!validCheckpoint(sweep) || !(sweep.previousGeneration === null || generation(sweep.previousGeneration)) || (sweep.previousGeneration === null ? sweep.generation !== '1' : BigInt(sweep.previousGeneration) + 1n !== BigInt(sweep.generation)) || !(sweep.lastTransition === null || (validCheckpoint(sweep.lastTransition?.expected) && validCheckpoint(sweep.lastTransition?.next) && same(sweep.lastTransition.next,sweep)))) throw Error('Invalid sweep authority');
  return sweep;
}
async function write(manager: EntityManager, sweep: Sweep): Promise<void> {
  await manager.query(`UPDATE directory_census_progress SET "registerRequest"=CASE WHEN $2::boolean THEN jsonb_set(jsonb_set("registerRequest", '{sweep}', $1::jsonb, true), '{lastCompletedSweep}', jsonb_build_object('generation',$3::text,'completedAt',CURRENT_TIMESTAMP), true) ELSE jsonb_set("registerRequest", '{sweep}', $1::jsonb, true) END, "updatedAt"=CURRENT_TIMESTAMP WHERE id='recovery'`,[JSON.stringify(sweep),sweep.phase==='complete',sweep.generation]);
}

export async function readRegisterSweep(db: DataSource, id: DirectoryRecoveryIdentity): Promise<RegisterSweepCheckpoint | null> {
  return db.transaction(async manager => { const s = await lock(manager,id); return s ? checkpoint(s) : null; });
}

/** expectedGeneration names the completed pass; null names the initial state. */
export async function beginRegisterSweep(db: DataSource, id: DirectoryRecoveryIdentity, expectedGeneration: string | null): Promise<RegisterSweepCheckpoint> {
  if (!(expectedGeneration === null || generation(expectedGeneration))) throw Error('Invalid sweep generation');
  return db.transaction(async manager => {
    const s = await lock(manager,id);
    if (s && s.previousGeneration === expectedGeneration) return checkpoint(s);
    if ((!s && expectedGeneration !== null) || (s && (s.phase !== 'complete' || s.generation !== expectedGeneration))) throw Error('Sweep checkpoint changed');
    if (s && BigInt(s.generation) === max) throw Error('Sweep generation exhausted');
    const next: Sweep = {generation:s ? (BigInt(s.generation)+1n).toString() : '1',phase:'census',cursor:null,previousGeneration:expectedGeneration,lastTransition:null};
    await write(manager,next); return checkpoint(next);
  });
}

export async function advanceRegisterSweep(db: DataSource, id: DirectoryRecoveryIdentity, expected: RegisterSweepCheckpoint, next: RegisterSweepCheckpoint): Promise<RegisterSweepCheckpoint> {
  if (!validCheckpoint(expected) || !validCheckpoint(next) || expected.generation !== next.generation || !((expected.phase === 'census' && next.phase === 'source' && next.cursor === null) || (expected.phase === 'source' && next.phase === 'directory' && next.cursor === null) || (expected.phase === 'directory' && next.phase === 'complete' && next.cursor === null) || (expected.phase === next.phase && expected.phase !== 'complete' && next.cursor !== null && (expected.cursor === null || next.cursor > expected.cursor)))) throw Error('Invalid sweep transition');
  return db.transaction(async manager => {
    const s = await lock(manager,id);
    if (!s) throw Error('Sweep checkpoint changed');
    if (same(s,next)) {
      if (s.lastTransition && same(s.lastTransition.expected,expected) && same(s.lastTransition.next,next)) return checkpoint(s);
      throw Error('Sweep checkpoint changed');
    }
    if (!same(s,expected)) throw Error('Sweep checkpoint changed');
    const updated: Sweep = {...s,...next,lastTransition:{expected:checkpoint(expected as Sweep),next:checkpoint(next as Sweep)}};
    await write(manager,updated); return checkpoint(updated);
  });
}
