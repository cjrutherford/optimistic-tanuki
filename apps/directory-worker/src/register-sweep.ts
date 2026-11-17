import { DataSource } from 'typeorm';
import { DirectoryRecoveryIdentity } from '../../directory/src/register-recovery-authority';
import {
  advanceRegisterSweep,
  beginRegisterSweep,
  readRegisterSweep,
  RegisterSweepCheckpoint,
} from '../../directory/src/register-sweep-authority';
import {
  CurrentSourceRead,
  ExactSourceRead,
  reconcileRegisterV2,
  repairRegisterV2,
} from '../../directory/src/register-reconciliation-v2';
import { RegisterToken } from './register-delivery';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Source = {
  census(
    identity: DirectoryRecoveryIdentity,
    cursor: string | null,
    limit: number
  ): Promise<string[]>;
  repair(
    identity: DirectoryRecoveryIdentity,
    id: string
  ): Promise<{ status: 'unchanged' | 'repaired' }>;
  scan(
    identity: DirectoryRecoveryIdentity,
    cursor: string | null,
    limit: number
  ): Promise<RegisterToken[]>;
  read(
    identity: DirectoryRecoveryIdentity,
    id: string,
    token: string
  ): Promise<ExactSourceRead>;
  current(
    identity: DirectoryRecoveryIdentity,
    id: string
  ): Promise<CurrentSourceRead>;
};

/** Process one durable page. Completion is observable before starting the next pass. */
export async function registerSweepPage(
  db: DataSource,
  identity: DirectoryRecoveryIdentity,
  source: Source,
  limit = 100
): Promise<'more' | 'complete'> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200)
    throw Error('Invalid register page limit');
  let state = await readRegisterSweep(db, identity);
  if (!state || state.phase === 'complete') {
    await beginRegisterSweep(db, identity, state?.generation ?? null);
    return 'more';
  }
  if (state.phase === 'census') {
    const ids = await source.census(identity, state.cursor, limit);
    if (!Array.isArray(ids) || ids.length > limit)
      throw Error('Invalid Social census page');
    let previous = state.cursor;
    for (const id of ids) {
      if (
        typeof id !== 'string' ||
        !uuid.test(id) ||
        (previous !== null && id <= previous)
      )
        throw Error('Invalid Social census page');
      previous = id;
    }
    for (const id of ids) {
      const repaired = await source.repair(identity, id);
      if (!repaired || !['unchanged', 'repaired'].includes(repaired.status))
        throw Error('Invalid Social repair response');
      const next: RegisterSweepCheckpoint = { ...state, cursor: id };
      await advanceRegisterSweep(db, identity, state, next);
      state = next;
    }
    if (ids.length === limit) return 'more';
    await advanceRegisterSweep(db, identity, state, {
      ...state,
      phase: 'source',
      cursor: null,
    });
    return 'more';
  }
  if (state.phase === 'source') {
    const entries = await source.scan(identity, state.cursor, limit);
    if (!Array.isArray(entries) || entries.length > limit)
      throw Error('Invalid register page');
    let previous = state.cursor;
    for (const entry of entries) {
      if (
        !entry ||
        typeof entry.communityId !== 'string' ||
        !uuid.test(entry.communityId) ||
        typeof entry.changeToken !== 'string' ||
        !uuid.test(entry.changeToken) ||
        !['changed', 'deleted'].includes(entry.operation) ||
        (previous !== null && entry.communityId <= previous)
      )
        throw Error('Invalid register page');
      previous = entry.communityId;
    }
    for (const entry of entries) {
      await reconcileRegisterV2(
        db,
        identity,
        entry.communityId,
        entry.changeToken,
        () => source.read(identity, entry.communityId, entry.changeToken)
      );
      const next: RegisterSweepCheckpoint = {
        ...state,
        cursor: entry.communityId,
      };
      await advanceRegisterSweep(db, identity, state, next);
      state = next;
    }
    if (entries.length === limit) return 'more';
    await advanceRegisterSweep(db, identity, state, {
      ...state,
      phase: 'directory',
      cursor: null,
    });
    return 'more';
  }
  const towns = await db.query(
    'SELECT "communityId" AS id FROM directory_town WHERE ($1::uuid IS NULL OR "communityId">$1::uuid) ORDER BY "communityId" LIMIT $2',
    [state.cursor, limit]
  );
  for (const { id } of towns) {
    if (
      typeof id !== 'string' ||
      !uuid.test(id) ||
      (state.cursor !== null && id <= state.cursor)
    )
      throw Error('Invalid Directory page');
    const repaired = await source.repair(identity, id);
    if (!repaired || !['unchanged', 'repaired'].includes(repaired.status))
      throw Error('Invalid Social repair response');
    await repairRegisterV2(db, identity, id, () =>
      source.current(identity, id)
    );
    const next: RegisterSweepCheckpoint = { ...state, cursor: id };
    await advanceRegisterSweep(db, identity, state, next);
    state = next;
  }
  if (towns.length === limit) return 'more';
  await advanceRegisterSweep(db, identity, state, {
    ...state,
    phase: 'complete',
    cursor: null,
  });
  return 'complete';
}
