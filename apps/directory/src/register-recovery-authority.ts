import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

export type DirectoryRecoveryIdentity = {
  sourceEpoch: string;
  activationId: string;
  socialGeneration: string;
  recoveryEpoch: string;
  owner: string;
  directoryGeneration: string;
};
type Phase = 'blocked' | 'reg-source' | 'reg-directory' | 'reg-running';
type Checkpoint = { phase: Phase; cursor: string | null };
type Begin = {
  sourceEpoch: string;
  activationId: string;
  socialGeneration: string;
  owner: string;
  expectedPrevious: DirectoryRecoveryIdentity | null;
  externalFence: true;
};
const fields: (keyof DirectoryRecoveryIdentity)[] = [
  'sourceEpoch',
  'activationId',
  'socialGeneration',
  'recoveryEpoch',
  'owner',
  'directoryGeneration',
];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const generation = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[1-9][0-9]*$/.test(v) &&
  BigInt(v) <= 9223372036854775807n;
const validIdentity = (v: DirectoryRecoveryIdentity) =>
  v &&
  [v.sourceEpoch, v.activationId, v.recoveryEpoch, v.owner].every(
    (x) => typeof x === 'string' && uuid.test(x)
  ) &&
  generation(v.socialGeneration) &&
  generation(v.directoryGeneration);
const same = (a: DirectoryRecoveryIdentity, b: DirectoryRecoveryIdentity) =>
  fields.every((k) => a[k] === b[k]);
const identity = (p: DirectoryRecoveryIdentity): DirectoryRecoveryIdentity => ({
  sourceEpoch: p.sourceEpoch,
  activationId: p.activationId,
  socialGeneration: p.socialGeneration,
  recoveryEpoch: p.recoveryEpoch,
  owner: p.owner,
  directoryGeneration: p.directoryGeneration,
});
const lock = async (manager: any) => {
  await manager.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('directory-recovery-authority-v1', 0))"
  );
  const installations = await manager.query(
    "SELECT * FROM directory_installation WHERE id='recovery-authority' FOR UPDATE"
  );
  const rows = await manager.query(
    "SELECT * FROM directory_census_progress WHERE id='recovery' FOR UPDATE"
  );
  if (
    installations.length !== rows.length ||
    rows.length > 1 ||
    (rows.length &&
      (!validIdentity(rows[0]) ||
        rows[0].recoveryEpoch !== installations[0].recoveryEpoch))
  )
    throw Error('Invalid recovery authority');
  return rows[0];
};

/** Caller asserts that every old writer and serving process has been externally fenced. */
export async function beginRegisterRecovery(db: DataSource, request: Begin) {
  if (
    !request ||
    request.externalFence !== true ||
    ![request.sourceEpoch, request.activationId, request.owner].every(
      (x) => typeof x === 'string' && uuid.test(x)
    ) ||
    !generation(request.socialGeneration) ||
    (request.expectedPrevious !== null &&
      !validIdentity(request.expectedPrevious))
  )
    throw Error('Invalid recovery request or external fence assertion');
  const recorded = {
    sourceEpoch: request.sourceEpoch,
    activationId: request.activationId,
    socialGeneration: request.socialGeneration,
    owner: request.owner,
    expectedPrevious:
      request.expectedPrevious === null
        ? null
        : identity(request.expectedPrevious),
  };
  return db.transaction(async (manager) => {
    const old = await lock(manager);
    // JSONB key order is canonicalized by PostgreSQL, so compare structurally in SQL.
    if (old?.protocol === 'register-pending-v1') {
      const retry = await manager.query(
        "SELECT (\"registerRequest\" - 'lastTransition' - 'sweep' - 'lastCompletedSweep') = $1::jsonb AS equal FROM directory_census_progress WHERE id='recovery'",
        [JSON.stringify(recorded)]
      );
      if (retry[0].equal)
        return { ...identity(old), phase: old.phase, cursor: old.cursor };
    }
    if (
      (old &&
        (!request.expectedPrevious || !same(old, request.expectedPrevious))) ||
      (!old && request.expectedPrevious !== null)
    )
      throw Error('Expected previous recovery identity mismatch');
    if (old && BigInt(old.directoryGeneration) === 9223372036854775807n)
      throw Error('Directory generation exhausted');
    const recoveryEpoch = randomUUID(),
      directoryGeneration = old
        ? (BigInt(old.directoryGeneration) + 1n).toString()
        : '1';
    await manager.query(
      'UPDATE directory_boundary_decision SET "invalidatedAt"=CURRENT_TIMESTAMP WHERE "invalidatedAt" IS NULL'
    );
    await manager.query('DELETE FROM directory_reviewed_geometry');
    await manager.query('DELETE FROM directory_boundary_candidate');
    await manager.query(
      `UPDATE directory_town SET "geometryStatus"='pending' WHERE "geometryStatus" <> 'pending'`
    );
    await manager.query(
      `UPDATE directory_provider_work SET status='blocked', "updatedAt"=CURRENT_TIMESTAMP`
    );
    await manager.query(
      `INSERT INTO directory_installation (id, "recoveryEpoch") VALUES ('recovery-authority',$1) ON CONFLICT (id) DO UPDATE SET "recoveryEpoch"=EXCLUDED."recoveryEpoch"`,
      [recoveryEpoch]
    );
    await manager.query(
      `INSERT INTO directory_census_progress (id,phase,cursor,protocol,"registerRequest","sourceEpoch","recoveryEpoch",owner,"activationId","socialGeneration","directoryGeneration") VALUES ('recovery','blocked',NULL,'register-pending-v1',$1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET phase='blocked',cursor=NULL,protocol=EXCLUDED.protocol,"registerRequest"=EXCLUDED."registerRequest","sourceEpoch"=EXCLUDED."sourceEpoch","recoveryEpoch"=EXCLUDED."recoveryEpoch",owner=EXCLUDED.owner,"activationId"=EXCLUDED."activationId","socialGeneration"=EXCLUDED."socialGeneration","directoryGeneration"=EXCLUDED."directoryGeneration","enabledPayload"=NULL,"updatedAt"=CURRENT_TIMESTAMP`,
      [
        JSON.stringify(recorded),
        request.sourceEpoch,
        recoveryEpoch,
        request.owner,
        request.activationId,
        request.socialGeneration,
        directoryGeneration,
      ]
    );
    return {
      sourceEpoch: request.sourceEpoch,
      activationId: request.activationId,
      socialGeneration: request.socialGeneration,
      owner: request.owner,
      recoveryEpoch,
      directoryGeneration,
      phase: 'blocked',
      cursor: null,
    };
  });
}

/** Compare-and-set a bounded checkpoint. Repeating an already committed transition is safe. */
export async function advanceRegisterRecovery(
  db: DataSource,
  id: DirectoryRecoveryIdentity,
  expected: Checkpoint,
  next: Checkpoint
) {
  const phases: Phase[] = [
    'blocked',
    'reg-source',
    'reg-directory',
    'reg-running',
  ];
  const validCheckpoint = (c: Checkpoint) =>
    c &&
    phases.includes(c.phase) &&
    (c.cursor === null ||
      (typeof c.cursor === 'string' && uuid.test(c.cursor))) &&
    (!['blocked', 'reg-running'].includes(c.phase) || c.cursor === null);
  if (
    !validIdentity(id) ||
    !validCheckpoint(expected) ||
    !validCheckpoint(next)
  )
    throw Error('Invalid recovery checkpoint');
  const from = phases.indexOf(expected.phase),
    to = phases.indexOf(next.phase);
  if (
    !(to === from + 1 && next.cursor === null) &&
    !(
      to === from &&
      ['reg-source', 'reg-directory'].includes(expected.phase) &&
      next.cursor !== null &&
      (expected.cursor === null || next.cursor > expected.cursor)
    )
  )
    throw Error('Invalid recovery transition');
  return db.transaction(async (manager) => {
    const p = await lock(manager);
    if (!p || p.protocol !== 'register-pending-v1' || !same(p, id))
      throw Error('Recovery authority mismatch');
    // The destination alone does not identify the transition that committed it.
    if (p.phase === next.phase && p.cursor === next.cursor) {
      const retry = await manager.query(
        "SELECT \"registerRequest\"->'lastTransition' = $1::jsonb AS equal FROM directory_census_progress WHERE id='recovery'",
        [JSON.stringify({ expected, next })]
      );
      if (retry[0]?.equal) return { phase: p.phase, cursor: p.cursor };
      throw Error('Recovery checkpoint changed');
    }
    if (p.phase !== expected.phase || p.cursor !== expected.cursor)
      throw Error('Recovery checkpoint changed');
    await manager.query(
      'UPDATE directory_census_progress SET phase=$1,cursor=$2,"registerRequest"=jsonb_set("registerRequest", \'{lastTransition}\', $3::jsonb, true),"updatedAt"=CURRENT_TIMESTAMP WHERE id=\'recovery\'',
      [next.phase, next.cursor, JSON.stringify({ expected, next })]
    );
    return next;
  });
}
